import express from "express";
import {
  createConversation,
  ensureSupportConversation,
  getConversations,
  getMessages,
  markAsSeen,
  resetSupportConversation,
} from "../controllers/conversationController.js";
import { checkFriendship } from "../middlewares/friendMiddleware.js";

const router = express.Router();

router.post("/", checkFriendship, createConversation);
router.post("/support-room", ensureSupportConversation);
router.post("/:conversationId/support-reset", resetSupportConversation);
router.get("/", getConversations);
router.get("/:conversationId/messages", getMessages);
router.patch("/:conversationId/seen", markAsSeen);

export default router;
