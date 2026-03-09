export default function UndoToast({ open, message, onUndo, onClose }) {
  if (!open) return null;

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <div className="undo-toast__msg">{message}</div>
      <div className="undo-toast__actions">
        <button className="undo-toast__btn" onClick={onUndo}>
          Undo
        </button>
        <button className="undo-toast__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
}