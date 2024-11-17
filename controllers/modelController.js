import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import { fileURLToPath } from 'url';
import database_config from '../model/database_config.js';

const promisePool = database_config.promisePool
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let model;
let recyc_model;

const loadModel = async () => {
    try {
        if (model) {
            model.dispose();
        }
    
        model = await tf.node.loadSavedModel(path.join(__dirname, '..', 'savedModel'));
        const testTensor = tf.zeros([32, 180, 180, 3]);
        const testPred = model.predict(testTensor);
        console.log('Model loaded successfully:');
        
        testTensor.dispose();
        testPred.dispose();
        
        return true;
    } catch (error) {
        console.error('Error loading model:', error);
        throw error;
    }
};

// const loadRecycModel = async () => {
//     try {
//         if(recyc_model){
//             recyc_model.dispose();
//         }

//         recyc_model = await tf.node.loadSavedModel(path.join(__dirname, '..', 'recycModel'));
//         const testTensor = tf.zeros([32, 180, 180, 3]);
//         const testPred = model.predict(testTensor);
//         console.log('Recycle model loaded successfully');
        
//         testTensor.dispose();
//         testPred.dispose();

//         return true;
//     } catch (error) {
//         console.error('Error loading model:', error);
//         throw error;
//     }
// }

const getCurDate = () => {
    const curDate = new Date();
    const year = curDate.getFullYear();
    const month = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const expirationDay = `${year}-${month}-${day}`;
    return expirationDay
}

const predict = async (req, res) => {

    if(!req.session.user) return res.sendStatus(401)

    if (!model) {
        return res.status(500).json({
            success: false,
            error: 'Model not loaded'
        });
    }

    let inputTensor = null;
    let prediction = null;

    const {lat, long, loc} = req.body
    try {
        const classLabels = ['Glass', 'Metal', 'Plastic'];
        const recycClassLabels = ['Disposable', 'Recyclable'];

        const imgTensor = tf.node.decodeImage(req.file.buffer, 3).resizeBilinear([180, 180]).toFloat().expandDims()

        const predictions = model.predict(imgTensor)
        const predictionArr = await predictions.array();
        const highest = tf.tensor(predictionArr)
        const probs = highest.dataSync();
        const maxProb = Math.max(...probs);
        const predictedIndex = probs.indexOf(maxProb);
        const classType = classLabels[predictedIndex]
        console.log(classType)

        // const recycPrediction = secondModel.predict(imgTensor)
        // const recycPredictionArr = await recycPrediction.array();
        // const peak = tf.tensor(recycPredictionArr)
        // const probabilities = peak.dataSync();
        // const highestProb = Math.max(...probabilities);
        // const predictedClass = probabilities.indexOf(highestProb);
        // const wasteType = recycClassLabels[predictedClass]
        // console.log(wasteType)

        res.json({
            success: true,
            prediction: classLabels[predictedIndex],
            // type: recycClassLabels[predictedClass]
        });

        try {
            const date = getCurDate()
            const [scanRes] = await promisePool.query("INSERT INTO scan_history(email_address, image, category, longitude, latitude, location, scan_date, waste_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [req.session.user.email_address, req.file.buffer, classType, long, lat, loc, date, wasteType])
        } catch (error) {
            console.log('dberror:', error)
        }
        
    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (inputTensor) inputTensor.dispose();
        if (prediction) prediction.dispose();
    }
};


export default { 
    predict, 
    loadModel, 
    // loadRecycModel,
};