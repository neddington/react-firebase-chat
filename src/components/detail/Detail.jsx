import { useEffect, useRef, useState } from "react";
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { useChatStore } from "../../lib/chatStore";
import { auth, db } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import "./detail.css";

const Detail = () => {
    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock } = useChatStore();
    const { currentUser } = useUserStore();
    const [receiverTagline, setReceiverTagline] = useState(""); // State to store receiver's tagline
    const [sharedPhotos, setSharedPhotos] = useState([]); // State to store shared photos
    const [privacyHelpOpen, setPrivacyHelpOpen] = useState(true); // State to track the visibility of privacy & help section
    const [sharedPhotosOpen, setSharedPhotosOpen] = useState(true); // State to track the visibility of shared photos section

    useEffect(() => {
        // Fetch the receiver's tagline
        const fetchReceiverTagline = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", user.id));
                const userData = userDoc.data();
                if (userData && userData.tagline) {
                    setReceiverTagline(userData.tagline);
                } else {
                    setReceiverTagline("No tagline");
                }
            } catch (error) {
                console.error("Error fetching receiver's tagline:", error);
            }
        };
        fetchReceiverTagline();

        // Real-time update of tagline
        const unsubscribeTagline = onSnapshot(doc(db, "users", user.id), (snapshot) => {
            const userData = snapshot.data();
            if (userData && userData.tagline) {
                setReceiverTagline(userData.tagline);
            } else {
                setReceiverTagline("No tagline");
            }
        });

        return () => {
            unsubscribeTagline();
        };
    }, [user.id]);

    const handleBlock = async () => {
        if (!user) return;

        const userDocRef = doc(db, "users", currentUser.id);

        try {
            await updateDoc(userDocRef, {
                blocked: isReceiverBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
            });
            changeBlock();
        } catch (err) {
            console.log(err);
        }
    };

    useEffect(() => {
        // Fetch shared photos from Firestore
        const fetchSharedPhotos = async () => {
            try {
                const chatDoc = await getDoc(doc(db, "chats", chatId));
                const chatData = chatDoc.data();
                if (chatData && chatData.messages) {
                    const photos = chatData.messages.filter(message => message.img);
                    setSharedPhotos(photos);
                } else {
                    setSharedPhotos([]);
                }
            } catch (error) {
                console.error("Error fetching shared photos:", error);
            }
        };
        fetchSharedPhotos();
    }, [chatId]);

    const togglePrivacyHelp = () => {
        setPrivacyHelpOpen(!privacyHelpOpen);
    };

    const toggleSharedPhotos = () => {
        setSharedPhotosOpen(!sharedPhotosOpen);
    };

    return (
        <div className='detail'>
            <div className="user">
                <img src={user?.avatar || "./avatar.png"} alt="" />
                <h2>{user?.username}</h2>
                <p>{receiverTagline}</p> {/* Display receiver's tagline */}
            </div>
            <div className="info">
                <div className="option">
                    <div className="title">
                        <span>Chat Settings</span>
                        <img src="./arrowUp.png" alt="" />
                    </div>
                </div>
                <div className="option">
                    <div className="title" onClick={toggleSharedPhotos}>
                        <span>Shared photos</span>
                        <img src={sharedPhotosOpen ? "./arrowDown.png" : "./arrowUp.png"} alt="" />
                    </div>
                    {sharedPhotosOpen && (
                        <div className="photos">
                            {sharedPhotos.map((photo, index) => (
                                <div className="photoItem" key={index}>
                                    <div className="photoDetail">
                                        <img src={photo.img} alt="" />
                                        <span>{photo.name}</span>
                                    </div>
                                    <a href={photo.img} download={photo.name}>
                                        <img src="./download.png" alt="Download" className="icon" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="option">
                    <div className="title">
                        <span>Shared Files</span>
                        <img src="./arrowUp.png" alt="" />
                    </div>
                </div>
                <div className="option">
                    <div className="title" onClick={togglePrivacyHelp}>
                        <span>Privacy & Help</span>
                        <img src={privacyHelpOpen ? "./arrowDown.png" : "./arrowUp.png"} alt="" />
                    </div>
                    {privacyHelpOpen && (
                        <button onClick={handleBlock}>
                            {isCurrentUserBlocked
                                ? "You're Blocked, Report to Democracy Officer!"
                                : isReceiverBlocked
                                ? "User Blocked & Reported"
                                : "Block & Report to Democracy Officer"}
                        </button>
                    )}
                </div>
                <button className="logout" onClick={() => auth.signOut()}>Logout</button>
            </div>
        </div>
    );
};

export default Detail;
