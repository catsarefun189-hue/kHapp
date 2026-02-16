import React from 'react';
import QRCode from 'qrcode.react';

const QRCodeGenerator = ({ type, data }) => {
    let qrValue;
    
    switch (type) {
        case 'join':
            qrValue = `https://myapp.com/join?data=${data}`;
            break;
        case 'dm':
            qrValue = `https://myapp.com/dm?data=${data}`;
            break;
        case 'groupChat':
            qrValue = `https://myapp.com/groupChat?data=${data}`;
            break;
        default:
            qrValue = '';
    }
    
    return (
        <div>
            <h2>{type === 'join' ? 'Join QR Code' : type === 'dm' ? 'Direct Message QR Code' : 'Group Chat QR Code'}</h2>
            <QRCode value={qrValue} />
        </div>
    );
};

export default QRCodeGenerator;