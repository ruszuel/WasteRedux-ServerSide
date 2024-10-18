import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import connection from '../model/database_config.js';

dotenv.config()

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

const getCurDate = () => {
    const curDate = new Date();
    const year = curDate.getFullYear();
    const month = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const expirationDay = `${year}-${month}-${day}`;
    return expirationDay
}

const otpVerification = async (req, res) => {
    const { email_address } = req.body
    const OTP = Math.floor(1000 + Math.random() * 9000).toString();
    const expiration = 3 * 60 * 1000
    const currentTime = new Date();
    const expirationDate = new Date(currentTime.getTime() + expiration);
    const expirationTime = expirationDate.toTimeString().slice(0, 8);
    const expirationDay = getCurDate()
   
    connection.query("SELECT * FROM users WHERE email_address = ?", [email_address], (err, data) => {
        if(err) return res.status(401).send(err)
        
        if(data.length === 0) {
            return res.status(403).send("No such email exist") 
        }

        connection.query("SELECT * FROM otp WHERE email_address=?", [email_address], (err, data) => {
            let temp, count;
            if(err) return res.status(401).send(err)

            if(data.length > 0){
                temp = data.map((val) => parseInt(val.attemps))
            }

            if(isNaN(temp)){
                count = 1 
                console.log(count)
            }else{
                count = parseInt(temp) + 1 
                console.log(temp)
            }

            if(parseInt(temp) >= 3) return res.sendStatus(429)

            const mailOptions = {
                from: process.env.EMAIL,
                to: email_address,
                subject: 'OTP Verification Code',
                text: `Your OTP verification code is ${OTP}`,
            }
        
            transporter.sendMail(mailOptions, (err) => {
                if(err) {
                    return res.status(500).send("Error sending mail: " + err.toString())
                }

                if(data.length > 0) {
                    connection.query("UPDATE otp SET otp_code=?, expiry=?, expiry_date = ?, attemps=? WHERE email_address=?", [OTP, expirationTime, expirationDay, count, email_address], (err) => {
                        if(err) return res.status(401).send(err)
                    })
                    return res.sendStatus(200)
                }

                connection.query("INSERT INTO otp VALUES (?, ?, ?, ?, ?)", [email_address, OTP, expirationTime, expirationDay, count], (err, info) => {
                    if (err) return res.status(500).send(err)
                    res.status(200).send('OTP Verification sent');
                }) 
            })

        })

    })
} 

const verifyOTP = (req, res) => {
    const { email_address, otp } = req.body
    connection.query("SELECT * from otp WHERE email_address = ?", [email_address], (err, result) => {
        if(err) return res.status(403).send(err)
        
        if(result.length === 0){
            return res.status(403).send("No data found")
        }

        const otp_code = result.map((val) => val.otp_code)
        const expiry = result.map((val) => val.expiry)
        const expiry_day = result.map((val) => {
            const curDate = new Date(val.expiry_date);
            const year = curDate.getFullYear();
            const month = String(curDate.getMonth() + 1).padStart(2, '0');
            const day = String(curDate.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            return formattedDate
        })

        const time = new Date()
        const getTime = new Date(time.getTime())
        const cTime = getTime.toTimeString().slice(0, 8)
        const currentDate = getCurDate()
        
        if(otp === otp_code.toString() && currentDate === expiry_day.toString() &&cTime <= expiry.toString()){
            console.log(currentDate)
            return res.status(200).send("Successful")
        }
        
        console.log(expiry_day);
        
        return res.status(500).send("Invalid OTP code")
    })
}



export default {otpVerification, verifyOTP}