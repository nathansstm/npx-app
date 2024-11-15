// ./CreateIcons.js
import React from 'react';
import { IconButton } from '@mui/material';

const CreateIcons = ({ children, sx, ...props }) => {
    return (
        <IconButton
            sx={{
                borderRadius: '50%',
                border: '1px solid #007fff',
                color: '#007fff',
                padding: '8px', // Add padding to create space between icon and border
                ...sx, // Allow for additional styles to be passed in
            }}
            {...props}
        >
            {children}
        </IconButton>
    );
};

export default CreateIcons;