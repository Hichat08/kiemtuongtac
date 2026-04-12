export const serializeCommunityGift = (gift) => {
  if (!gift) {
    return null;
  }

  const resolvedGift = typeof gift.toObject === "function" ? gift.toObject() : gift;

  return {
    _id: resolvedGift._id?.toString?.() ?? resolvedGift._id ?? "",
    conversationId:
      resolvedGift.conversationId?.toString?.() ?? resolvedGift.conversationId ?? "",
    messageId: resolvedGift.messageId?.toString?.() ?? resolvedGift.messageId ?? "",
    senderId: resolvedGift.senderId?.toString?.() ?? resolvedGift.senderId ?? "",
    senderAccountId: resolvedGift.senderAccountId ?? "",
    senderDisplayName: resolvedGift.senderDisplayName ?? "Thành viên",
    totalAmount: Number(resolvedGift.totalAmount ?? 0),
    remainingAmount: Number(resolvedGift.remainingAmount ?? 0),
    recipientLimit: Number(resolvedGift.recipientLimit ?? 0),
    remainingSlots: Number(resolvedGift.remainingSlots ?? 0),
    title: resolvedGift.title ?? "",
    note: resolvedGift.note ?? "",
    status: resolvedGift.status ?? "active",
    claims: (resolvedGift.claims ?? []).map((claim) => {
      const claimant =
        claim?.userId && typeof claim.userId === "object"
          ? {
              _id: claim.userId._id?.toString?.() ?? claim.userId._id ?? "",
              displayName: claim.userId.displayName ?? "Thành viên",
              avatarUrl: claim.userId.avatarUrl ?? null,
            }
          : null;

      return {
        userId: claimant?._id ?? claim?.userId?.toString?.() ?? claim?.userId ?? "",
        displayName: claimant?.displayName ?? "Thành viên",
        avatarUrl: claimant?.avatarUrl ?? null,
        amount: Number(claim?.amount ?? 0),
        claimedAt: claim?.claimedAt ?? null,
      };
    }),
    createdAt: resolvedGift.createdAt ?? null,
    updatedAt: resolvedGift.updatedAt ?? null,
  };
};

export const resolveCommunityGiftClaimAmount = (remainingAmount, remainingSlots) => {
  const safeRemainingAmount = Math.max(1, Math.round(Number(remainingAmount ?? 0)));
  const safeRemainingSlots = Math.max(1, Math.round(Number(remainingSlots ?? 0)));

  if (safeRemainingSlots <= 1) {
    return safeRemainingAmount;
  }

  const average = safeRemainingAmount / safeRemainingSlots;
  const minShare = Math.max(1, Math.floor(average * 0.45));
  const maxShare = Math.max(minShare, Math.floor(average * 1.55));
  const randomShare =
    minShare + Math.floor(Math.random() * (maxShare - minShare + 1));

  return Math.min(randomShare, safeRemainingAmount - (safeRemainingSlots - 1));
};
