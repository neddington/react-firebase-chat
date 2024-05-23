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

const Chat = () => {
    const [chat, setChat] = useState(); 
    const [open,setOpen] = useState(false)
    const [text,setText] = useState("")

    const { currentUser } = useUserStore();
    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } =
      useChatStore()

    const endRef = useRef(null)

    useEffect(()=>{
        endRef.current?.scrollIntoView({behavior:"smooth"})
    },[])

    useEffect(() => {
        const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
          setChat(res.data());
        });
    
        return () => {
          unSub();
        };
      }, [chatId]);
    
    const handleEmoji = (e) =>{
        setText(prev=>prev+e.emoji);
        setOpen(false)
    };

    const handleSend = async ()=>{
        if(text === "") return;

        try{

            await updateDoc(doc(db, "chats", chatId),{
                messages:arrayUnion({
                    senderId: currentUser.id,
                    text,
                    createdAt: new Date(),

                }),
            });

            const userIDs = [currentUser.id, user.id];

            userIDs.forEach(async (id)=>{

            
            const userChatRef = doc(db,"userchats", id)
            const userChatSnapshot = await getDoc(userChatRef)

            if(userChatSnapshot.exists()){
                const userChatsData = userChatSnapshot.data()

                const chatIndex = userChatsData.chats.findIndex(c=> c.chatId === chatId)

                userChatsData.chats[chatIndex].lastMessage = text;
                userChatsData.chats[chatIndex].isSeen = 
                    id === currentUser.id ? true : false;
                userChatsData.chats[chatIndex].updatedAt = Date.now();

                await updateDoc(userChatRef,{
                    chats:userChatsData.chats,
                });
            }
        });

        }catch(err){
            console.log(err)
        }
    };

    return (
        <div className='chat'>
            <div className="top">
                <div className="user">
                    <img src="./avatar.png" alt="" />
                    <div className="texts">
                        <span>Jane Doe</span>
                        <p>Lorem ipsum dolor sit amet.</p>
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
                <div className="message own" key={message.createAt}>
                    <div className="texts">
                        {message.img && <img 
                            src={message.img} 
                            alt="" 
                        />}
                        <p>{message.text}
                        </p>
                        {/*<span>{message.createAt}</span>*/}
                    </div>
                </div>
                ))}
                <div ref={endRef}></div>
            </div>
            <div className="bottom">
                <div className="icons">
                <img src="./img.png" alt="" />
                <img src="./camera.png" alt="" />
                <img src="./mic.png" alt="" />
                </div>
                <input 
                    type="text" 
                    placeholder="For Democracy..." 
                    value={text}
                    onChange={e=>setText(e.target.value)}/>
                <div className="emoji">
                    <img 
                        src="./emoji.png" 
                        alt="" 
                        onClick={()=>setOpen(prev=>!prev)}
                    />
                    <div className="picker">
                    <EmojiPicker open={open} onEmojiClick={handleEmoji}/>
                    </div>
                </div>
                <button className="sendButton" onClick={handleSend}>Send</button>
            </div>
        </div>
    )
}

export default Chat