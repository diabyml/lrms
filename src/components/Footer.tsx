import { useState, useRef } from "react";
import { format } from "date-fns";

function parseDateParts(dateStr: string) {
    const d = new Date(dateStr);
    return {
        day: d.getDate().toString().padStart(2, '0'),
        month: (d.getMonth() + 1).toString().padStart(2, '0'),
        year: d.getFullYear().toString(),
    };
}

export default function Footer({ date }: { date: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [dateParts, setDateParts] = useState(parseDateParts(date));
    const wrapperRef = useRef<HTMLSpanElement>(null);
    let blurTimeout: NodeJS.Timeout;

    const handleDateClick = () => setIsEditing(true);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDateParts((prev) => ({ ...prev, [name]: value.replace(/\D/g, '') }));
    };
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") setIsEditing(false);
    };
    const handleWrapperBlur = () => {
        // Delay to allow focus to move between fields
        blurTimeout = setTimeout(() => setIsEditing(false), 0);
    };
    const handleWrapperFocus = () => {
        if (blurTimeout) clearTimeout(blurTimeout);
    };

    const combinedDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

    return (
        <div className="flex items-center justify-between  font-bold">
            <p>
                Bamako, le{" "}
                {isEditing ? (
                    <span
                        ref={wrapperRef}
                        tabIndex={-1}
                        onBlur={handleWrapperBlur}
                        onFocus={handleWrapperFocus}
                    >
                        <input
                            type="text"
                            name="day"
                            value={dateParts.day}
                            onChange={handleChange}
                            onKeyDown={handleInputKeyDown}
                            maxLength={2}
                            size={2}
                            className="border-b border-gray-400 focus:outline-none bg-transparent w-6 text-center mx-0.5"
                            autoFocus
                        />/
                        <input
                            type="text"
                            name="month"
                            value={dateParts.month}
                            onChange={handleChange}
                            onKeyDown={handleInputKeyDown}
                            maxLength={2}
                            size={2}
                            className="border-b border-gray-400 focus:outline-none bg-transparent w-6 text-center mx-0.5"
                        />/
                        <input
                            type="text"
                            name="year"
                            value={dateParts.year}
                            onChange={handleChange}
                            onKeyDown={handleInputKeyDown}
                            maxLength={4}
                            size={4}
                            className="border-b border-gray-400 focus:outline-none bg-transparent w-10 text-center mx-0.5"
                        />
                    </span>
                ) : (
                    <span onClick={handleDateClick} style={{ cursor: "pointer" }} title="Click to edit date">
                        {format(new Date(combinedDate), "dd/MM/yyyy")}
                    </span>
                )}
            </p>
            <p>Le Biologiste</p>
        </div>
    );
}