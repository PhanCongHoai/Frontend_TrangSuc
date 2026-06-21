import React from "react";

function ConfirmModal({ isOpen, message, title = "Xác nhận thao tác", onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="admin-center-toast-backdrop" onClick={onCancel}>
      <div
        className="admin-center-toast admin-center-toast-confirm"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-center-toast-icon">❓</div>
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="admin-toast-actions">
          <button
            type="button"
            className="admin-toast-btn secondary"
            onClick={onCancel}
          >
            Hủy
          </button>
          <button
            type="button"
            className="admin-toast-btn primary"
            onClick={onConfirm}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
