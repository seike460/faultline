'use strict';

const console = require('console');
const aws = require('../lib/aws')();
const kms = aws.kms;

module.exports.handler = (event, context, cb) => {
    const notifications = event.notifications;
    const res = event.res;

    const notifyCall = (n) => {
        if (typeof n !== 'object') {
            cb('notifyCall error', n);
            return;
        }

        const notifier = require(`../lib/notifications/${n.type}`);

        res.forEach((e) => {
            const resByTimeunitCount = e.counts[0];
            const resCount = e.counts[1];
            let notifyInterval = n.notifyInterval ? n.notifyInterval : 1;
            let threshold = n.threshold ? n.threshold : 1;
            if (resCount == 1) {
                // first notify
                notifier.call(null, n, e.detail);
            } else if (threshold < 0) {
                return;
            } else if (resByTimeunitCount >= threshold
                       && (resByTimeunitCount % notifyInterval) == 0) {
                notifier.call(null, n, e.detail);
            }
        });
    };

    notifications.forEach((n) => {
        if (typeof n === 'string') {
            // KMS encrypted
            const kmsEncyptedToken = n;
            const encryptedBuf = new Buffer(kmsEncyptedToken, 'base64');
            const cipherText = { CiphertextBlob: encryptedBuf };
            kms.decrypt(cipherText).promise().then((data) => {
                const decrypted = JSON.parse(data.Plaintext.toString('ascii'));
                notifyCall(decrypted);
            }).catch((err) => {
                console.error(err);
                cb(new Error('Decrypt error. Error JSON:', JSON.stringify(err, null, 2)));
            });
        } else {
            notifyCall(n);
        }
    });
};
