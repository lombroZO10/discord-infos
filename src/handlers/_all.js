import ChatConnectionHandler from "./ChatConnectionHandler.js"
import ChatControllerHandler from "./ChatControllerHandler.js"
import DoneHandler from "./DoneHandler.js"
import DuplicateHandler from "./DuplicateHandler.js"
import IdleConnectionHandler from "./IdleConnectionHandler.js"
import KissTransferGiftHandler from "./KissTransferGiftHandler.js"
import LoginErrorHandler from "./LoginErrorHandler.js"
import LogoutHandler from "./LogoutHandler.js"
import MessageHandler from "./MessageHandler.js"
import PrivateMessageHandler from "./PrivateMessageHandler.js"
import TickleHandler from "./TickleHandler.js"
import UserJoinedHandler from "./UserJoinedHandler.js"
import UserLeftHandler from "./UserLeftHandler.js"

export default [
    ChatConnectionHandler,
    ChatControllerHandler,
    DoneHandler,
    DuplicateHandler,
    IdleConnectionHandler,
    KissTransferGiftHandler,
    LoginErrorHandler,
    LogoutHandler,
    MessageHandler,
    PrivateMessageHandler,
    TickleHandler,
    UserJoinedHandler,
    UserLeftHandler
];