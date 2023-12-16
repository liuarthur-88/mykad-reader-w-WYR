const fs = require('fs');
const path = require('path');
const moment = require('moment');
const winston = require('winston');
const notifier = require('node-notifier').WindowsToaster;
const DailyRotateFile = require('winston-daily-rotate-file');

const currentWorkingDirectory = path.join(process.cwd());
const addIconPath = path.join(currentWorkingDirectory, 'app', './media/logo/team.png');
const errorIconPath = path.join(currentWorkingDirectory, 'app', './media/logo/close.png');


const appUtils = () => { };

// ========================================================================
// URL Validation
appUtils.isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

// ========================================================================
//
appUtils.isPrivateIP = (ip) => {
  const ipParts = ip.split('.').map(Number);

  // Check for private IP address ranges
  if (
    (ipParts[0] === 10) ||
    (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) ||
    (ipParts[0] === 192 && ipParts[1] === 168)
  ) {
    return true;
  }

  return false;
};

// ========================================================================
// Pop-out notification
appUtils.winNotification = ({ appID, message, bool }) => {

  const iconPath = bool ? addIconPath : errorIconPath;

  const Notification = new notifier({
    withFallback: false, // Try Windows Toast and Growl first?
    customPath: undefined // Relative/Absolute path if you want to use your fork of notifu
  });

  Notification.notify({
    appID: appID,
    type: 'info',
    title: appID,
    message: message,
    icon: iconPath,
    sound: true,
    wait: true,
  });
};

// ========================================================================
// Logger
const logFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf(
    (info) => `${moment(info.timestamp).format('YYYY-MM-DD HH:mm:ss')} : ${info.message}`,
  ),
);

const transport = new DailyRotateFile({
  filename: './/logs//NodeWinstonApp-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  prepend: true,
  level: null,
  localTime: true,
});

appUtils.logger = winston.createLogger({
  format: logFormat,
  transports: [
    transport,
    new winston.transports.Console({
      level: 'info',
    }),
  ],
});

// ========================================================================
// export
module.exports = appUtils;
