import express from 'express'
import userController from '../controllers/userController.js'
import verificationController from '../controllers/verificationController.js'
import modelController from '../controllers/modelController.js'
import multer from 'multer'

const storage = multer.memoryStorage()
const upload = multer({storage})
const route = express.Router();

route.get('/', userController.display);
route.post('/create', userController.insert);
route.post('/login', userController.login)
route.post('/verify', userController.verification)
route.get('/verify/:token', userController.verifyEmail)
route.get('/login/profile', userController.profile)
route.patch('/login/update_profile',upload.single('image'), userController.updateProfile)
route.patch('/login/profile/change_password', userController.changePassword)
route.post('/request/otp', verificationController.otpVerification)
route.post('/request/verify_otp', verificationController.verifyOTP)
route.post('/register_waste', upload.single('image'), userController.registerWaste)
route.get('/first_time', userController.firstTime)
route.get('/logout', userController.logout)
route.post('/auto_login', userController.autoLogin)
route.patch('/reset_pass', userController.resetPass)
route.get('/history', userController.history)
route.get('/home', userController.home)
route.post('/predict', upload.single('image'), modelController.predict)

export default route;