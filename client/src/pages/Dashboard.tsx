import React, { useState } from "react";
import Modal from "../components/common/Modal";

const Dashboard: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => setIsModalOpen(true)}
      >
        Open Modal
      </button>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2 className="text-lg font-semibold mb-2">Modal Title</h2>
        <p>This is a dummy modal. You can put any content here.</p>
      </Modal>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">Widget 1</div>
        <div className="bg-white p-4 rounded shadow">Widget 2</div>
      </div>
    </div>
  );
};

export default Dashboard;
