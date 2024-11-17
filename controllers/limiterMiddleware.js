import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, 
    limit: 10, 
    standardHeaders: true, 
    legacyHeaders: false,
    keyGenerator: (req) => req.body.email_address,
});

const limiterStore = limiter.store;

export default {limiter, limiterStore}