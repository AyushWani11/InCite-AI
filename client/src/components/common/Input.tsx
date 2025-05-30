import React from "react";

interface InputProps {
  label?: string;
  type?: string;
  value: string;
  name: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  type = "text",
  value,
  name,
  placeholder,
  onChange,
  error,
}) => (
  <div className="mb-4">
    {label && <label className="block mb-1 font-medium">{label}</label>}
    <input
      type={type}
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 ${
        error ? "border-red-500 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200"
      }`}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

export default Input;
