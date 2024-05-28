import { useEffect, useRef, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import {
    arrayUnion,
    doc,
    getDoc,
    onSnapshot,
    updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { get } from "firebase/database";
import upload from "../../lib/upload";
import { format } from "timeago.js";

const Chat = () => {
    const [receiverTagline, setReceiverTagline] = useState("");
    const [chat, setChat] = useState();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [img, setImg] = useState({
        file: null,
        url: "",
    });
    const [audio, setAudio] = useState({
        file: null,
        url: "",
    });

    const { currentUser } = useUserStore();
    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } =
        useChatStore();

    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

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
    
        // Real-time update of tagline
        const unsubscribeTagline = onSnapshot(doc(db, "users", user.id), (snapshot) => {
            const userData = snapshot.data();
            if (userData && userData.tagline) {
                setReceiverTagline(userData.tagline);
            } else {
                setReceiverTagline("No tagline");
            }
        });
    
        // Real-time update of chat messages
        const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
            setChat(res.data());
        });
    
        // Cleanup
        return () => {
            unSub();
            unsubscribeTagline();
        };
    }, [user.id, chatId]);
    

    const handleEmoji = (e) => {
        setText((prev) => prev + e.emoji);
        setOpen(false);
    };

    const handleImg = (e) => {
        if (e.target.files[0]) {
            setImg({
                file: e.target.files[0],
                url: URL.createObjectURL(e.target.files[0]),
            });
        }
    };

    const handleAudio = (e) => {
        if (e.target.files[0]) {
            setAudio({
                file: e.target.files[0],
                url: URL.createObjectURL(e.target.files[0]),
            });
        }
    };

    const handleSend = async () => {
        if (text === "" || isCurrentUserBlocked || isReceiverBlocked) return;

        let imgUrl = null;
        let audioUrl = null;

        try {
            if (img.file) {
                imgUrl = await upload(img.file);
            }

            if (audio.file) {
                audioUrl = await upload(audio.file);
            }

            await updateDoc(doc(db, "chats", chatId), {
                messages: arrayUnion({
                    senderId: currentUser.id,
                    text,
                    createdAt: new Date(),
                    ...(imgUrl && { img: imgUrl }),
                    ...(audioUrl && { audio: audioUrl }),
                }),
            });

            const userIDs = [currentUser.id, user.id];

            userIDs.forEach(async (id) => {
                const userChatRef = doc(db, "userchats", id);
                const userChatSnapshot = await getDoc(userChatRef);

                if (userChatSnapshot.exists()) {
                    const userChatsData = userChatSnapshot.data();

                    const chatIndex = userChatsData.chats.findIndex(
                        (c) => c.chatId === chatId
                    );

                    userChatsData.chats[chatIndex].lastMessage = text;
                    userChatsData.chats[chatIndex].isSeen =
                        id === currentUser.id ? true : false;
                    userChatsData.chats[chatIndex].updatedAt = Date.now();

                    await updateDoc(userChatRef, {
                        chats: userChatsData.chats,
                    });
                }
            });
        } catch (err) {
            console.log(err);
        }

        setImg({
            file: null,
            url: "",
        });

        setAudio({
            file: null,
            url: "",
        });

        setText("");
    };

    return (
        <div className="chat">
            <div className="top">
                <div className="user">
                    <img src={user?.avatar || "./avatar.png"} alt="" />
                    <div className="texts">
                        <span>{user?.username}</span>
                        <p>{receiverTagline}</p>
                    </div>
                </div>
                <div className="icons">
                    <img src="./phone.png" alt="" />
                    <img src="./video.png" alt="" />
                    <img src="./info.png" alt="" />
                </div>
            </div>
            <div className="center">
                {chat?.messages?.map((message) => (
                    <div
                        className={
                            message.senderId === currentUser?.id
                                ? "message own"
                                : "message"
                        }
                        key={message.createAt}
                    >
                        <div className="texts">
                            {message.img && <img src={message.img} alt="" />}
                            {message.audio && (
                                <audio controls>
                                    <source
                                        src={message.audio}
                                        type="audio/mp3"
                                    />
                                    Your browser does not support the audio
                                    element.
                                </audio>
                            )}
                            <p>{message.text}</p>
                            <span>{format(message.createdAt.toDate())}</span>
                        </div>
                    </div>
                ))}
                {img.url && (
                    <div className="message own">
                        <div className="texts">
                            <img src={img.url} alt="" />
                        </div>
                    </div>
                )}
                {audio.url && (
                    <div className="message own">
                        <div className="texts">
                            <audio controls>
                                <source src={audio.url} type="audio/mp3" />
                                Your browser does not support the audio
                                element.
                            </audio>
                        </div>
                    </div>
                )}
                <div ref={endRef}></div>
            </div>
            <div className="bottom">
                <div className="icons">
                    {!isCurrentUserBlocked && !isReceiverBlocked && (
                        <>
                            <label htmlFor="file">
                                <img src="./img.png" alt="" />
                            </label>
                            <input
                                type="file"
                                id="file"
                                style={{ display: "none" }}
                                onChange={handleImg}
                            />
                            <label htmlFor="audio">
                                <img src="./mic.png" alt="" />
                            </label>
                            <input
                                type="file"
                                id="audio"
                                style={{ display: "none" }}
                                accept="audio/*"
                                onChange={handleAudio}
                            />
                        </>
                    )}
                    <img src="./camera.png" alt="" />
                </div>
                <input
                    type="text"
                    placeholder={
                        isCurrentUserBlocked || isReceiverBlocked
                            ? "Under Review for undemocractic behavior"
                            : "For Democracy..."
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={isCurrentUserBlocked || isReceiverBlocked}
                />
                <div className="emoji">
                    {!isCurrentUserBlocked && !isReceiverBlocked && (
                        <img
                            src="./emoji.png"
                            alt=""
                            onClick={() => setOpen((prev) => !prev)}
                        />
                    )}
                    <div className="picker">
                        {!isCurrentUserBlocked && !isReceiverBlocked && (
                            <EmojiPicker
                                open={open}
                                onEmojiClick={handleEmoji}
                            />
                        )}
                    </div>
                </div>
                <button
                    className="sendButton"
                    onClick={handleSend}
                    disabled={isCurrentUserBlocked || isReceiverBlocked}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default Chat;
