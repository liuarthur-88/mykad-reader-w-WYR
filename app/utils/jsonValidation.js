const fs = require('fs');
const path = require('path');
const appUtils = require('./appUtils');
const currentWorkingDirectory = process.cwd();

const validateConfig = (config) => {

    const requiredFields = ['_target_reader', '_url', '_working_dir', '_exec_file', '_result_file', '_image_folder', '_image_scheduler_setting', '_keep_images', '_clean_up_images_after_x_month'];

    for (const field of requiredFields) {
        if (!(field in config)) {
            return `Field '${field}' is missing.`;
        }

        const value = config[field];

        switch (field) {
            case '_targetReader':
            case '_image_scheduler_setting':
                if (typeof value !== 'string') {
                    return `Field '${field}' must be a non-empty string.`;
                }
                break;
            case '_url':
                if (typeof value !== 'string' || !appUtils.isValidUrl(value)) {
                    return `Field '${field}' must be a valid URL.`;
                }
                break;
            case '_working_dir':
            case '_exec_file':
            case '_result_file':
            case '_image_folder':
                if (typeof value !== 'string' || value.trim() === '') {
                    return `Field '${field}' must be a non-empty string.`;
                }
                break;
            case '_keep_images':
            case '_clean_up_images_after_x_month':
                if (typeof value !== 'number' || isNaN(value) || !Number.isInteger(value)) {
                    return `Field '${field}' must be a valid integer.`;
                }
                break;
        }
    }

    return true;
}

// ========================================================================
// export
module.exports = validateConfig;