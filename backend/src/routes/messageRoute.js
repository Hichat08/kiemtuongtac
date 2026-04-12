import express from "express";

import {
  openCommunityGift,
  sendDirectMessage,
  sendGroupMessage,
  submitCommunityUserReport,
} from "../controllers/messageController.js";
import {
  checkFriendship,
  checkGroupMembership,
} from "../middlewares/friendMiddleware.js";

const router = express.Router();

router.post("/direct", checkFriendship, sendDirectMessage);
router.post("/group", checkGroupMembership, sendGroupMessage);
router.post("/community-gifts/:giftId/open", openCommunityGift);
router.post("/community-reports", submitCommunityUserReport);

export default router;
