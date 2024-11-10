import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import database_config from '../model/database_config.js';

const promisePool = database_config.promisePool
dotenv.config()

const email = process.env.EMAIL;
const pass = process.env.EMAIL_PASSWORD;
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: email,
        pass: pass
    },
    secure: true
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
    const { email_address } = req.body;
    const OTP = Math.floor(1000 + Math.random() * 9000).toString();
    const expiration = 3 * 60 * 1000;
    const currentTime = new Date();
    const expirationDate = new Date(currentTime.getTime() + expiration);
    const expirationTime = expirationDate.toTimeString().slice(0, 8);
    const expirationDay = getCurDate();

    try {
        const [userData] = await promisePool.query("SELECT * FROM users WHERE email_address = ?", [email_address]);
        if (userData.length === 0) {
            return res.status(403).send("No such email exists");
        }

        const [otpData] = await promisePool.query("SELECT * FROM otp WHERE email_address = ?", [email_address]);
        let count = 1; 
        if (otpData.length > 0) {
            count = parseInt(otpData[0].attemps) + 1;
            if (count > 3) return res.sendStatus(429); 
        }

        const mailOptions = {
            from: process.env.EMAIL,
            to: email_address,
            subject: 'OTP Verification Code',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
                <h2 style="color: #333; text-align: center;">OTP Verification</h2>
                <p style="font-size: 18px; color: #555;">Dear User,</p>
                <p style="font-size: 18px; color: #555;">Thank you for your request. Your OTP (One-Time Password) verification code is:</p>
                <p style="font-size: 24px; text-align: center; color: #81A969;"><b>${OTP}</b></p>
                <p style="font-size: 18px; color: #555;">This code is valid for <strong>3 minutes</strong>. Please enter this code on the verification page to complete the process.</p>
                <p style="font-size: 18px; color: #555;">If you did not request this OTP, please disregard this email.</p>
                <p style="font-size: 18px; color: #555;">If you have any questions, feel free to contact our support team.</p>
                <p style="font-size: 18px; color: #555;">Best regards,<br>WasteRedux</p>
            </div> `,
        };

        await transporter.sendMail(mailOptions);

        if (otpData.length > 0) {
            await promisePool.query(
                "UPDATE otp SET otp_code = ?, expiry = ?, expiry_date = ?, attemps = ? WHERE email_address = ?",
                [OTP, expirationTime, expirationDay, count, email_address]
            );
        } else {
            await promisePool.query(
                "INSERT INTO otp (email_address, otp_code, expiry, expiry_date, attemps) VALUES (?, ?, ?, ?, ?)",
                [email_address, OTP, expirationTime, expirationDay, count]
            );
        }

        return res.status(200).send('OTP Verification sent');
    } catch (err) {
        return res.status(500).send(err.message);
    }
};

const verifyOTP = async (req, res) => {
    const { email_address, otp } = req.body;

    try {
        const [result] = await promisePool.query("SELECT * FROM otp WHERE email_address = ?", [email_address]);

        if (result.length === 0) {
            return res.status(403).send("No data found");
        }

        const otp_code = result[0].otp_code;
        const expiry = result[0].expiry;
        const expiry_day = result[0].expiry_date;

        const currentTime = new Date();
        const currentDate = getCurDate();

        const formattedCurrentTime = currentTime.toTimeString().slice(0, 8);
        
        const curDate = new Date(expiry_day);
        const year = curDate.getFullYear();
        const month = String(curDate.getMonth() + 1).padStart(2, '0');
        const day = String(curDate.getDate()).padStart(2, '0');
        const formattedExpiryDay = `${year}-${month}-${day}`;

        console.log(formattedExpiryDay, currentDate)
        
        if (otp === otp_code && currentDate === formattedExpiryDay && formattedCurrentTime <= expiry) {
            return res.status(200).send("Successful");
        }

        return res.status(500).send("Invalid OTP code");
    } catch (err) {
        return res.status(403).send(err);
    }
};

export default {otpVerification, verifyOTP}