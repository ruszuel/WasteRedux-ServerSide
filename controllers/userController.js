import connection from '../model/database_config.js';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

dotenv.config();
const display =  (req, res) => {
    connection.query('SELECT * from users', (err, result) =>{
        if (err) throw err;
        res.json(result)
        console.log(process.env.EMAIL)
    })  
}

const insert = async (req, res) => {
    const receivedData = req.body
    console.log(receivedData)
    const hashedPass = await bcrypt.hash(receivedData.user_password, 12)
    connection.query('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)', [receivedData.first_name, receivedData.last_name, receivedData.email_address, receivedData.college_department, hashedPass, false, true], (err) => {
        if (err) throw err;
        res.status(200).send('inserted successfully')
    })
}

const login = (req, res) => {
    const {email_address, user_password, rememberme} = req.body
    connection.query('SELECT * from users WHERE email_address = ?', [email_address], async (err, result) => {
        if (err) throw err;

        console.log(email_address)
        if(result.length === 0){
            res.status(401).send('Invalid Credential')
            return 
        }

        const isVerified = result.map((val) => val.isVerified)
        if(parseInt(isVerified) === 0){
            res.status(403).send("Email is not verified")
            return
        }

        const userPass = result[0].user_password
        const isValid = await bcrypt.compare(user_password, userPass.toString())
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
                req.session.user = result[0]
                if(rememberme){     
                    req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000
                    return res.status(200).json({sessionId: req.session.id})
                }
                return res.sendStatus(200)
            })
        }
    })  
}

const firstTime = (req, res) => {
    if(!req.session.email) return res.sendStatus(401)

    connection.query("UPDATE users SET isFirstTime = ? WHERE email_address =?", [0, req.session.email], (err) => {
        if (err) return res.status(400).send('Error updating data')
       
        connection.query('SELECT * from users WHERE email_address = ?', [req.session.email], async (err, result) => {
            if(err) return res.status(500).send(err)
            
            delete req.session.email
            req.session.regenerate((err) => {
                if (err) return res.status(500).send("Failed regenerating session")
                req.session.user = result[0]
                if(rememberme){     
                    req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000
                    return res.status(200).json({sessionId: req.session.id})
                }
                return res.sendStatus(200)
            })
        })
    })
}

const autoLogin = (req, res) => {
    const {auto_id} = req.body

    connection.query("SELECT * FROM sessions WHERE session_id=?", [auto_id], (err, result) => {
        if(err) return res.status(500).send(err)
        
        if(result.length === 0){
            return res.status(201).send("Session expired")
        }
        return res.sendStatus(200)

    })
}

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

const verifyEmail = (req, res) => {
    const { token } = req.params

    jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, data) => {
        if(err){
            res.sendStatus(401)
            return
        }
        connection.query('UPDATE users SET isVerified = ? WHERE email_address = ?', [true, data.email], (err) => {
            if (err) 
                console.log(err)
        })
        res.sendStatus(200)
    })
}

const logout = (req, res) => {
    if(!req.session.user) return res.sendStatus(401)

    req.session.destroy((err) => {
        if (err) return res.sendStatus(403)
        
        console.log(req.session)
        res.sendStatus(200) 
    })
}

const profile = (req, res) => {
    if(!req.session.user) return res.sendStatus(401)
    const mail = req.session.user.email_address
    connection.query("SELECT * FROM users where email_address = ?", [mail], (err, data) => {
        if(err) return res.status(400).send(err)

        const modified = data.map(user => ({
            ...user, 
            profile_picture: user.profile_picture ? `data:${user.picture_format};base64,${user.profile_picture.toString('base64')}`: null
        }))
        return res.status(200).send(modified)
    })
    
}

const updateProfile = (req, res) => {
    if(!req.session.user) return res.sendStatus(401)

    const {first_name, last_name} = req.body

    let updateQuery = "UPDATE users SET first_name = ?, last_name = ?";
    let queryParams = [first_name, last_name];

    if (req.file) {
        updateQuery += ", profile_picture = ?, picture_format = ?";
        queryParams.push(req.file.buffer);
        queryParams.push(req.file.mimetype)
    }

    updateQuery += " WHERE email_address = ?";
    queryParams.push(req.session.user.email_address);

    connection.query(updateQuery, queryParams, (err, result) => {
        if (err) return res.status(403).json(err)
        return res.status(200).send(result)
    })
}

const changePassword = async (req, res) => {
    if(!req.session.user)
        return res.sendStatus(401)

    const {new_password, old_password} = req.body
    const isValid = await bcrypt.compare(old_password, req.session.user.user_password)
    if(!isValid){
        return res.sendStatus(403)
    }else{
        const newPass = await bcrypt.hash(new_password, 12)
        connection.query("UPDATE users SET user_password = ? WHERE email_address = ?", [newPass, req.session.user.email_address], (err, result) => {
            if (err) return res.status(403).send(err)
            return res.sendStatus(200)
        })
    }
}

const registerWaste = (req, res) => {
    if(!req.session.user) return res.sendStatus(401)

    const curDate = new Date();
    const year = curDate.getFullYear();
    const month = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const registered_date = `${year}-${month}-${day}`;
    
    const {category} = req.body
    const img = req.file
    if(!img){
        return res.sendStatus(204)
    }

    const { buffer } = req.file
    connection.query("INSERT INTO unrecognized_images (email_address, category, image, date_registered) VALUES (?, ?, ?, ?) ", [req.session.user.email_address, category, buffer, registered_date], (err) => {
        if(err) return res.send(err)
        return res.status(200).send('image successfully inserted')
    })
    
}

export default {display, insert, login, verification, verifyEmail, logout, profile, updateProfile, changePassword, registerWaste, firstTime, autoLogin}