import { useEffect, useRef, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import {
    arrayUnion,
    doc,
    getDoc,
    onSnapshot,
    updateDoc,
    collection,
    addDoc,
    setDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import upload from "../../lib/upload";
import { format } from "timeago.js";
import Peer from "simple-peer";
import 'webrtc-adapter';

// Polyfill global and process
if (typeof global === 'undefined') {
    window.global = window;
}

if (typeof process === 'undefined') {
    window.process = {
        env: {
            NODE_ENV: 'development'
        }
    };
}

const Chat = () => {
    const [receiverTagline, setReceiverTagline] = useState("");
    const [chat, setChat] = useState();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [img, setImg] = useState({ file: null, url: "" });
    const [audio, setAudio] = useState({ file: null, url: "" });
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [peerInstance, setPeerInstance] = useState(null);
    const localVideo = useRef(null);
    const remoteVideo = useRef(null);

    const { currentUser } = useUserStore();
    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } = useChatStore();

    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    useEffect(() => {
        if (!user?.id || !chatId) return;

        const fetchReceiverTagline = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", user.id));
                const userData = userDoc.data();
                setReceiverTagline(userData?.tagline || "No tagline");
            } catch (error) {
                console.error("Error fetching receiver's tagline:", error);
            }
        };

        const unsubscribeTagline = onSnapshot(doc(db, "users", user.id), (snapshot) => {
            const userData = snapshot.data();
            setReceiverTagline(userData?.tagline || "No tagline");
        });

        const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
            setChat(res.data());
        });

        fetchReceiverTagline();

        return () => {
            unSub();
            unsubscribeTagline();
        };
    }, [user?.id, chatId]);

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
        if ((!text && !img.file && !audio.file) || isCurrentUserBlocked || isReceiverBlocked) return;

        let imgUrl = null;
        let audioUrl = null;

        try {
            if (img.file) {
                imgUrl = await upload(img.file);
            }

            if (audio.file) {
                audioUrl = await upload(audio.file);
            }

            const message = {
                senderId: currentUser.id,
                createdAt: new Date(),
                ...(text && { text }),
                ...(imgUrl && { img: imgUrl }),
                ...(audioUrl && { audio: audioUrl }),
            };

            await updateDoc(doc(db, "chats", chatId), {
                messages: arrayUnion(message),
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

                    userChatsData.chats[chatIndex].lastMessage = text || "Media message";
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

        setImg({ file: null, url: "" });
        setAudio({ file: null, url: "" });
        setText("");
    };

    const startCall = async (video = false) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
            setLocalStream(stream);
            localVideo.current.srcObject = stream;
            const peer = new Peer({ initiator: true, trickle: false, stream });
            setPeerInstance(peer);
            setupPeer(peer, true);
        } catch (err) {
            console.error("Error starting call:", err);
        }
    };

    const answerCall = async (offer, video = false) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
            setLocalStream(stream);
            localVideo.current.srcObject = stream;
            const peer = new Peer({ initiator: false, trickle: false, stream });
            setPeerInstance(peer);
            peer.signal(offer);
            setupPeer(peer, false);
        } catch (err) {
            console.error("Error answering call:", err);
        }
    };

    const setupPeer = (peer, isInitiator) => {
        const callDoc = doc(db, "calls", chatId);
        const offerCandidates = collection(callDoc, "offerCandidates");
        const answerCandidates = collection(callDoc, "answerCandidates");

        peer.on("signal", async (data) => {
            try {
                if (isInitiator) {
                    await setDoc(callDoc, { offer: data });
                } else {
                    await setDoc(callDoc, { answer: data });
                }
            } catch (err) {
                console.error("Error signaling peer:", err);
            }
        });

        peer.on("stream", (stream) => {
            remoteVideo.current.srcObject = stream;
            setRemoteStream(stream);
        });

        peer.on("error", (err) => {
            console.error("Peer error:", err);
        });

        peer.on("close", () => {
            console.log("Peer connection closed");
        });

        onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (data?.offer && !isInitiator) {
                peer.signal(data.offer);
            } else if (data?.answer && isInitiator) {
                peer.signal(data.answer);
            }
        });

        onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    peer.addIceCandidate(candidate);
                }
            });
        });

        onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    peer.addIceCandidate(candidate);
                }
            });
        });
    };

    const endCall = () => {
        if (peerInstance) {
            peerInstance.destroy();
            setPeerInstance(null);
            setLocalStream(null);
            setRemoteStream(null);
            localVideo.current.srcObject = null;
            remoteVideo.current.srcObject = null;
        }
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
                    <img src="./phone.png" alt="" onClick={() => startCall(false)} />
                    <img src="./video.png" alt="" onClick={() => startCall(true)} />
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
                        key={message.createdAt}
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
                            {message.text && <p>{message.text}</p>}
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
                            ? "Under Review for undemocratic behavior"
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
            <div className="video-container">
                <video ref={localVideo} autoPlay muted style={{ width: "300px", height: "300px" }} />
                <video ref={remoteVideo} autoPlay style={{ width: "300px", height: "300px" }} />
                {peerInstance && (
                    <button className="endCallButton" onClick={endCall}>
                        End Call
                    </button>
                )}
            </div>
        </div>
    );
};

export default Chat;
