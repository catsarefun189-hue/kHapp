import React, { useState } from 'react';
import QRCode from 'qrcode.react';

const SignupForm = () => {
    const [username, setUsername] = useState('');
    const [qrValue, setQrValue] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        // Here you'd typically handle signup logic, e.g., hitting an API
        setQrValue(username); // Generate QR code based on username
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label htmlFor='username'>Username:</label>
                <input
                    type='text'
                    id='username'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
            </div>
            <button type='submit'>Sign Up</button>
            {qrValue && <QRCode value={qrValue} />}
        </form>
    );
};

export default SignupForm;