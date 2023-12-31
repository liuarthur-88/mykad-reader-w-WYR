const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const pcsclite = require('@pokusew/pcsclite');
const schedule = require('node-schedule');
const { spawn } = require('child_process');
const appUtils = require('./utils/appUtils');
const validateConfig = require('./utils/jsonValidation');
const currentWorkingDirectory = process.cwd();

let cardInserted = false;
let errorHandle = false;

// Default setting
const setupInfo = {
    appID: 'MyKad Reader',
    relativePath: '/pms/q',
    arguments: ['-read'],
};

const postData = {
    sid: "69CDA559-B593-4B4C-8F65-40DF7906B9D3",
    code: "ctc_interface",
    axn: "u",
    data: {}
};

const readConfig = async () => {
    try {
        const configPath = path.join(currentWorkingDirectory, 'app', 'user-config.json');

        await fs.access(configPath);

        const rawConfig = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(rawConfig);

        const validationResult = await validateConfig(config);
        
        if (typeof validationResult === 'string') {

            appUtils.winNotification({
                appID: setupInfo.appID,
                message: 'Config validation error, please check the json file.',
                wait: false,
                time: 2,
            }, () => { });

            appUtils.logger.info('Config validation error, please check the json file.');

            return;
        }

        appUtils.logger.info('--======================================--');
        appUtils.logger.info('--======= Config validation - ok =======--');
        appUtils.logger.info('--======================================--');

        setupInfo.targetReaderName = config._target_reader;
        setupInfo.baseUrl = config._url;
        setupInfo.workingDirectory = config._working_dir;
        setupInfo.execFilename = config._exec_file;
        setupInfo.resultFilename = config._result_file;

        // Image Handler
        setupInfo.imageSchedulerTime = config._image_scheduler_setting;
        setupInfo.keepImages = config._keep_images;
        setupInfo.cleanUpImagesAfterXMonth = config._clean_up_images_after_x_month;

        // URL
        setupInfo.fullURL = path.join(setupInfo.baseUrl, setupInfo.relativePath).replace(/\\/g, '/').replace(':/', '://');

        // Folder path
        setupInfo.resultFilePath = path.join(setupInfo.workingDirectory, setupInfo.resultFilename);
        setupInfo.imageFolderPath = path.join(setupInfo.workingDirectory, config._image_folder);


    } catch (error) {

        appUtils.winNotification({
            appID: setupInfo.appID,
            message: `Error reading config file: ${error}`,
            wait: false,
            time: 2,
        }, () => { });

        appUtils.logger.info('Error reading config file:', error);
    }
}

const deleteOldFiles = async (directoryPath) => {
    try {
        const files = await fs.readdir(directoryPath);

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);

            // Calculate the difference in milliseconds between the current date and the file's last modification time
            const timeDifference = Date.now() - stats.mtime.getTime();
            const oneMonthInMilliseconds = setupInfo.cleanUpImagesAfterXMonth * 30 * 24 * 60 * 60 * 1000;

            if (timeDifference > oneMonthInMilliseconds) {
                // File is older than one month, delete it
                await fs.unlink(filePath);
                appUtils.logger.info(`Deleted file: ${filePath}`);
            }
        }
    } catch (error) {

        appUtils.winNotification({
            appID: setupInfo.appID,
            message: 'Error deleting old files.',
            wait: false,
            time: 2,
        }, () => { });

        appUtils.logger.info('Error deleting old files:', error);
    }
}

const handleProcessExit = (resolve, reject, code) => {
    if (code === 0) {
        // Process exited successfully
        resolve();
    } else {
        // Process exited with an error
        reject();
    }
};

const handleCardInsertion = async () => {

    const childProcess = spawn(setupInfo.execFilename, setupInfo.arguments, {
        cwd: setupInfo.workingDirectory,
        stdio: 'inherit',
        shell: true,
    });

    await new Promise((resolve, reject) => {
        fs.watch(setupInfo.resultFilePath, (curr, prev) => {
            if (curr.mtime > prev.mtime) {
                resolve();
            }
        });

        // Handle process exit
        childProcess.on('exit', (code) => {
            handleProcessExit(resolve, reject, code);
        });
    });;

    // Read the contents of mykadresult.txt
    const fileContents = await fs.readFile(setupInfo.resultFilePath, 'utf-8');
    const jsonData = JSON.parse(fileContents);

    // Extract and assign values to postData.data
    const { name, dob, IC, gender, race, add1, add2, add3, postcode, city, state } = jsonData;
    postData.data = {
        name,
        dob,
        id_no: IC,
        gender,
        race,
        addr1: `${add1} ${add2}`,
        addr2: add3,
        postcode,
        city,
        state,
    };

    try {

        const response = await fetch(setupInfo.fullURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
        });

        const data = await response.json();

        if (!response.ok) {

            appUtils.winNotification({
                appID: setupInfo.appID,
                message: 'Failed to create/ update customer details.',
                wait: false,
                time: 2,
            }, () => { });

            appUtils.logger.info('Request failed with status:', response.status);
        }

        appUtils.winNotification({
            appID: setupInfo.appID,
            message: `Customer: ${postData.data.name} (${data.data.code})`,
            bool: true, 
            wait: false,
            time: 2,
        }, () => { });

        appUtils.logger.info(`Customer: ${postData.data.name} (${data.data.code})`);

    } catch (error) {

        appUtils.winNotification({
            appID: setupInfo.appID,
            message: 'Error making POST request',
            wait: false,
            time: 2,
        }, () => { });

        appUtils.logger.info('Error making POST request:', error);
    }
};

const handleCardRemoval = () => {
    cardInserted = false;
};

const setupReader = (reader) => {

    reader.on('status', async (status) => {
        const readerStatus = !!(status.state & reader.SCARD_STATE_PRESENT);
        const cardStatus = !!(status.state & reader.SCARD_STATE_EMPTY);

        try {
            if (readerStatus !== cardInserted && !cardInserted) {
                cardInserted = true;

                if (status.atr == 0) {
                    cardInserted = false;

                    appUtils.winNotification({
                        appID: setupInfo.appID,
                        message: 'Invalid card',
                        wait: false,
                        time: 2,
                    }, () => { });

                    appUtils.logger.info('Invalid card');
                    return;
                }

                await handleCardInsertion();
            }
        } catch (error) {

            appUtils.logger.info('Error during card insertion/ withdrawn.');

        } finally {
            if (cardStatus) {
                handleCardRemoval();
            }
        }
    });

    reader.on('error', (err) => {

        appUtils.winNotification({
            appID: setupInfo.appID,
            message: 'Error in the reader',
            wait: false,
            time: 2,
        }, () => { });

        appUtils.logger.info(`Error in the reader ${setupInfo.targetReaderName}:`, err);
    });
};

const init = async () => {
    try {

        await readConfig();

        schedule.scheduleJob(setupInfo.imageSchedulerTime, async () => {

            appUtils.logger.info('--======================================--');
            appUtils.logger.info('--======= Scheduled job executed =======--');
            appUtils.logger.info('--======================================--');

            if (!setupInfo.keepImages) {
                await deleteOldFiles(setupInfo.imageFolderPath);
            }
        });

        const pcsc = pcsclite();

        pcsc.on('reader', (reader) => {

            if (!reader.name) {
                reader.close();
                reader.on('end', () => { });
            }

            if (reader.name === setupInfo.targetReaderName) {
                setupReader(reader);
            }
        });

        pcsc.on('error', (err) => {

            appUtils.winNotification({
                appID: setupInfo.appID,
                message: 'PC/SC error',
                wait: false,
                time: 2,
            }, () => { });

            appUtils.logger.info('PC/SC error:', err);
        });
    } catch (error) {

        appUtils.winNotification({
            appID: setupInfo.appID,
            message: `Caught an error: ${error}`,
            wait: false,
            time: 2,
        }, () => { });

        appUtils.logger.info('Caught an error:', error);
    }
}

init();