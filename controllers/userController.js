import database_config from '../model/database_config.js';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

const promisePool = database_config.promisePool
dotenv.config();
const display = async (req, res) => {
    try{
        const [result] = await promisePool.query('SELECT * from users')  
        res.json(result)
    }catch(err){
        console.error('Error inserting data:', err);
        res.status(500).send('Internal Server Error');
    }
}

const insert = async (req, res) => {
    const receivedData = req.body
    try{
        const hashedPass = await bcrypt.hash(receivedData.user_password.trim(), 12)
        await promisePool.query('INSERT INTO users (first_name, last_name, email_address, college_department, user_password, isVerified, isFirstTime) VALUES (?, ?, ?, ?, ?, ?, ?)', [receivedData.first_name, receivedData.last_name, receivedData.email_address, receivedData.college_department, hashedPass, false, true])
        res.status(200).send('inserted successfully') 
    }catch(err){
        console.error('Error inserting data:', err);
        res.status(500).send('Internal Server Error');
    }
}

const login = async (req, res) => {
    const {email_address, user_password, rememberme} = req.body
    try{
        const [result] = await promisePool.query('SELECT * from users WHERE email_address = ?', [email_address])

        if(result.length === 0){
            res.status(401).send('Invalid Credential')
            return 
        }

        const isVerified = result.map((val) => val.isVerified)
        if(parseInt(isVerified) === 0){
            res.status(403).send("Email is not verified")
            return
        }

        const isValid = await bcrypt.compare(user_password.trim(), result[0].user_password)
        if(!isValid){
            res.status(401).send('Wrong password')
            return
        }

        const isFirstTime = result[0].isFirstTime
        if(parseInt(isFirstTime) === 1){
            req.session.email = result[0].email_address
            return res.sendStatus(201)
        }else{
            req.session.regenerate((err) => {
                if (err) return res.status(500).send("Failed regenerating session")
                if(rememberme){     
                    req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000
                    return res.status(200).json({sessionId: req.session.id})
                }
                req.session.user = result[0]
                return res.sendStatus(200)
            })
        } 
    }catch(err){
        if (err) throw err;
    }
 
}

const firstTime = async (req, res) => {
    if(!req.session.email) return res.sendStatus(401)

    try {
        await promisePool.query("UPDATE users SET isFirstTime = ? WHERE email_address =?", [0, req.session.email])

       const[result] = await promisePool.query('SELECT * from users WHERE email_address = ?', [req.session.email])
       delete req.session.email

       req.session.regenerate((err) => {
        if (err) return res.status(500).send("Failed regenerating session")
        req.session.user = result[0]
        return res.status(200).json({sessionId: req.session.id})
    })
    } catch (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(404).send('User not found');
        }
        return res.status(500).send(err);
    } 
}

const autoLogin = async (req, res) => {
    const { auto_id } = req.body;

    if (!auto_id) {
        return res.status(400).send("Missing auto_id");
    }

    try {
        const [result] = await promisePool.query("SELECT * FROM sessions WHERE session_id = ?", [auto_id]);
        if (result.length === 0) {
            return res.status(201).send("Session expired");
        }
        return res.sendStatus(200);
    } catch (err) {
        return res.status(500).send(err);
    }
};

const email = process.env.EMAIL;
const pass = process.env.EMAIL_PASSWORD;
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: email,
        pass: pass
    },
    secure: false
})

const verification = (req, res) => {
    const {email_address} = req.body
    const email = {email: email_address}
    const accessToken = jwt.sign(email, process.env.SECRET_ACCESS_TOKEN, {expiresIn: '5m'})
    const verifLink = `http://localhost:3000/user/verify/${accessToken}`

    const mailOptions = {
        from: email,
        to: email_address,
        subject: 'Verify Your Email',
        text: `Click the link to verify your email: ${verifLink}`  
    }

    transporter.sendMail(mailOptions, (err) => {
        if(err) {
            res.status(500).send("Error sending mail: " + err.toString())
            return
        }
        res.status(200).send('Verification email sent');
    })

}

const verifyEmail = async (req, res) => {
    const { token } = req.params;

    try {
        const data = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
                if (err) {
                    return reject(err);
                }
                resolve(decoded);
            });
        });

        await promisePool.query('UPDATE users SET isVerified = ? WHERE email_address = ?', [true, data.email]);
        return res.sendStatus(200);
    } catch (err) {
        console.error(err);
        return res.sendStatus(401);
    }
};

const logout = (req, res) => {
    if(!req.session.user) return res.sendStatus(401)

    req.session.destroy((err) => {
        if (err) return res.sendStatus(403)
        res.sendStatus(200) 
    })
}

const profile = async (req, res) => {
    if (!req.session.user) return res.sendStatus(401);

    const mail = req.session.user.email_address;

    try {
        const [data] = await promisePool.query("SELECT * FROM users WHERE email_address = ?", [mail]);

        const modified = data.map(user => ({
            ...user,
            profile_picture: user.profile_picture ? `data:${user.picture_format};base64,${user.profile_picture.toString('base64')}` : null
        }));

        return res.status(200).send(modified);
    } catch (err) {
        return res.status(400).send(err);
    }
};

const updateProfile = async (req, res) => {
    if (!req.session.user) return res.sendStatus(401);

    const { first_name, last_name } = req.body;

    let updateQuery = "UPDATE users SET first_name = ?, last_name = ?";
    let queryParams = [first_name, last_name];

    if (req.file) {
        updateQuery += ", profile_picture = ?, picture_format = ?";
        queryParams.push(req.file.buffer);
        queryParams.push(req.file.mimetype);
    }

    updateQuery += " WHERE email_address = ?";
    queryParams.push(req.session.user.email_address);

    try {
        const [result] = await promisePool.query(updateQuery, queryParams);
        return res.status(200).send(result);
    } catch (err) {
        return res.status(403).json(err);
    }
};

const changePassword = async (req, res) => {
    if (!req.session.user) {
        return res.sendStatus(401);
    }

    const { new_password, old_password } = req.body;

    try {
        const isValid = await bcrypt.compare(old_password, req.session.user.user_password);
        if (!isValid) {
            return res.sendStatus(403);
        }

        const newPass = await bcrypt.hash(new_password, 12);
        await promisePool.query("UPDATE users SET user_password = ? WHERE email_address = ?", [newPass, req.session.user.email_address]);

        return res.sendStatus(200);
    } catch (err) {
        return res.status(403).send(err);
    }
};

const registerWaste = async (req, res) => {
    if (!req.session.user) return res.sendStatus(401);

    const curDate = new Date();
    const year = curDate.getFullYear();
    const month = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const registered_date = `${year}-${month}-${day}`;

    const { category } = req.body;
    const img = req.file;

    if (!img) {
        return res.sendStatus(204);
    }

    const { buffer } = img;

    try {
        await promisePool.query("INSERT INTO unrecognized_images (email_address, category, image, date_registered) VALUES (?, ?, ?, ?)", 
            [req.session.user.email_address, category, buffer, registered_date]);
        
        return res.status(200).send('Image successfully inserted');
    } catch (err) {
        return res.status(500).send(err);
    }
};

const resetPass = async (req, res) => {
    const { new_pass, email_address } = req.body;

    try {
        const hashedPass = await bcrypt.hash(new_pass, 12);
        await promisePool.query("UPDATE users SET user_password = ? WHERE email_address = ?", [hashedPass, email_address]);

        return res.sendStatus(200);
    } catch (err) {
        return res.status(403).send(err);
    }
};

export default {display, insert, login, verification, verifyEmail, logout, profile, updateProfile, changePassword, registerWaste, firstTime, autoLogin, resetPass}