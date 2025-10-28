import React from "react";
import { MediaLibrary } from "@/components/MediaLibrary";
import { ToastContainer } from "@/components/Toast";
import { useToastStore } from "@/stores/toastStore";
import "./App.css";

function App() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="app">
      <MediaLibrary />
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}

export default App;
