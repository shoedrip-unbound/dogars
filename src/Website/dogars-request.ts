import express = require('express');

export interface Request extends express.Request {
    [idx: string]: any;
}
