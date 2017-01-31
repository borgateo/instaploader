"use strict";

const utils = require('./utils.js');

// Buttons
const uploadBtn = document.getElementById('upload-btn');
const uploadFileBtn = document.getElementById('upload-file');

// Textarea
const uploadTextarea = document.getElementById('upload-textarea');

// Placeholder
const imagePlaceholder = document.getElementById('image-placeholder');


// Events
uploadBtn.addEventListener('click', utils.upload, false);
uploadFileBtn.addEventListener('change', utils.updatePlaceholderImage, false);
