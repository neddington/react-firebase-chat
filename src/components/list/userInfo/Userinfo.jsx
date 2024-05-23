import React, { useState, useEffect } from "react";
import "./userInfo.css";
import { useUserStore } from "../../../lib/userStore";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const UserInfo = () => {
    const { currentUser } = useUserStore();
    const [tagline, setTagline] = useState("");
    const [editMode, setEditMode] = useState(false); // Edit mode flag

    useEffect(() => {
        const fetchTagline = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", currentUser.id));
                const userData = userDoc.data();
                if (userData && userData.tagline) {
                    setTagline(userData.tagline);
                } else {
                    setTagline("No tagline");
                }
            } catch (error) {
                console.error("Error fetching tagline:", error);
            }
        };

        fetchTagline();

        return () => {
            // Cleanup function
        };
    }, [currentUser.id]);

    const handleTaglineChange = (e) => {
        setTagline(e.target.value);
    };

    const handleEditToggle = async () => {
        // If in edit mode, update the tagline
        if (editMode) {
            try {
                await updateDoc(doc(db, "users", currentUser.id), {
                    tagline: tagline,
                });
            } catch (error) {
                console.error("Error updating tagline:", error);
            }
        }
        // Toggle edit mode
        setEditMode(!editMode);
    };

    return (
        <div className='userInfo'>
            <div className="user">
                <img src={currentUser.avatar || "./avatar.png"} alt="" />
                <div>
                    <h2>{currentUser.username}</h2>
                    {editMode ? (
                        <input
                            type="text"
                            value={tagline}
                            onChange={handleTaglineChange}
                        />
                    ) : (
                        <p>{tagline}</p>
                    )}
                </div>
            </div>
            <div className="icons">
                <img src="./more.png" alt="" />
                <img src="./video.png" alt="" />
                <img src="./edit.png" alt="" onClick={handleEditToggle} />
            </div>
            <div></div>
        </div>
    );
};

export default UserInfo;
