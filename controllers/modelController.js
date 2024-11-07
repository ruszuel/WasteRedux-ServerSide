import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import { fileURLToPath } from 'url';
import database_config from '../model/database_config.js';

const promisePool = database_config.promisePool
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let model;

const loadModel = async () => {
    try {
        if (model) {
            model.dispose();
        }
        
        model = await tf.loadGraphModel(`file://${path.join(__dirname, '..', 'cnn', 'model.json')}`);

        const testTensor = tf.zeros([1, 180, 180, 3]);
        const testPred = model.predict(testTensor);
        console.log('Model loaded successfully:', {
            inputShape: model.inputs[0].shape,
            outputShape: testPred.shape,
            backend: tf.getBackend(),
            memoryInfo: tf.memory()
        });
        
        testTensor.dispose();
        testPred.dispose();
        
        return true;
    } catch (error) {
        console.error('Error loading model:', error);
        throw error;
    }
};

const getCurDate = () => {
    const curDate = new Date();
    const year = curDate.getFullYear();
    const month = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const expirationDay = `${year}-${month}-${day}`;
    return expirationDay
}

const preprocessImage = async (imageBuffer) => {
    try {
        const processedBuffer = await sharp(imageBuffer)
            .resize(180, 180, { 
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 1 }
            })
            .removeAlpha()
            .toColorspace('srgb')
            .raw()
            .toBuffer();

        const expectedSize = 180 * 180 * 3;
        if (processedBuffer.length !== expectedSize) {
            throw new Error(`Invalid buffer size: ${processedBuffer.length} vs expected ${expectedSize}`);
        }

        return tf.tidy(() => {
            const tensor = tf.tensor3d(
                new Float32Array(processedBuffer), 
                [180, 180, 3]
            );
            
            const stats = {
                shape: tensor.shape,
                min: tensor.min().dataSync()[0],
                max: tensor.max().dataSync()[0],
            };
            console.log('Tensor stats:', stats);
            return tensor.div(255.0).expandDims(0);
        });
    } catch (error) {
        console.error('Detailed preprocessing error:', error);
        throw new Error(`Image preprocessing failed: ${error.message}`);
    }
};

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
        inputTensor = await preprocessImage(req.file.buffer);
        console.log('Input tensor shape:', inputTensor.shape);

        prediction = model.predict(inputTensor);
        const softmaxPredictions = tf.softmax(prediction);
        const predictionArray = await softmaxPredictions.array();
        // const predictionArray = await prediction.array();

        const result = tf.tidy(() => {
            const probabilities = tf.softmax(tf.tensor(predictionArray[0]));
            const classLabels = ['Glass', 'Metal', 'Plastic'];
            const probs = probabilities.dataSync();
            
            const maxProb = Math.max(...probs);
            const predictedIndex = probs.indexOf(maxProb);
            
            return {
                predictedClass: classLabels[predictedIndex],
                confidence: maxProb,
                allProbabilities: classLabels.map((label, idx) => ({
                    class: label,
                    probability: probs[idx]
                }))
            };
        });

        res.json({
            success: true,
            prediction: result,
            type: result.predictedClass === 'Plastic' ? 'Recyclable' : 'Non-recyclable'
        });

        try {
            const date = getCurDate()
            const wasteType = result.predictedClass === 'Glass' ? 'Non-recyclable':'Recyclable' 
            const [scanRes] = await promisePool.query("INSERT INTO scan_history(email_address, image, category, longitude, latitude, location, scan_date, waste_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [req.session.user.email_address, req.file.buffer, result.predictedClass, long, lat, loc, date, wasteType])
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
        // Cleanup
        if (inputTensor) inputTensor.dispose();
        if (prediction) prediction.dispose();
    }
};


export default { 
    predict, 
    loadModel, 
};