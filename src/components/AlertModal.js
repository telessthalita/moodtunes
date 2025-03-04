// components/AlertModal.js
import React from 'react';
import '../App.css';

const AlertModal = ({ message, onClose }) => {
  return (
    <div className="alert-modal-overlay">
      <div className="alert-modal">
        <p>{message}</p>
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
};

export default AlertModal;