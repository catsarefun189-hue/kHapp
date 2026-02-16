import React from 'react';
import './RightClickMenu.css';

const RightClickMenu = ({ isOpen, items, onClose, position }) => {
    return (
        <div className={`context-menu ${isOpen ? 'open' : ''}`} style={{ top: position.y, left: position.x }}>
            {items.map((item, index) => (
                <div key={index} className="context-menu-item" onClick={item.onClick}>
                    {item.label}
                </div>
            ))}
            <div className="circular-pointer" />
        </div>
    );
};

export default RightClickMenu;
