const Comment = require("../models/commentModel");
const Post = require("../models/postsModel");
const { errorHandler } = require("../middlewares/errorHandling");
const mongoose = require("mongoose");

const createComment = async (req, res, next) => {
  try {
    const { content, slug, userId } = req.body;
    console.log("Received userId:", userId);

    if (!userId) {
      return next(errorHandler(400, "User ID is required"));
    }

    const newComment = new Comment({
      content,
      slug,
      userId, // Make sure userId is being passed correctly from frontend
    });

    const savedComment = await newComment.save();
    console.log("Saved comment:", savedComment);

    // Use proper population with error handling
    const populatedComment = await Comment.findById(savedComment._id)
      .populate("userId", "username image _id email picture")
      .lean();
    console.log("Populated comment:", populatedComment);

    if (!populatedComment) {
      return next(errorHandler(404, "Error populating comment"));
    }

    // Update the post with the new comment
    await Post.findOneAndUpdate(
      { slug },
      { $push: { comments: savedComment._id } }
    );

    res.status(200).json(populatedComment);
  } catch (error) {
    next(error);
  }
};

const getPostComments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    console.log("Fetching comments for slug:", req.params.slug);

    // First, find raw comments to check if they have userId
    const rawComments = await Comment.find({ slug: req.params.slug });
    console.log("Raw comments before population:", rawComments);

    const comments = await Comment.find({ slug: req.params.slug })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username picture image _id email");

    console.log("Comments after population:", comments);

    const formattedComments = comments.map((comment) => {
      console.log(
        "Processing comment:",
        comment._id,
        "userId:",
        comment.userId
      );
      return {
        ...comment.toObject(),
        userId: comment.userId || {
          _id: null,
          username: "Deleted User",
          image: null,
          email: null,
        },
      };
    });

    res.status(200).json({
      comments: formattedComments,
      hasMore: comments.length === limit,
    });
  } catch (error) {
    console.error("Error in getPostComments:", error);
    next(error);
  }
};

const likeComment = async (req, res, next) => {
  try {
    // Log the incoming request
    console.log("Liking comment with ID:", req.params.commentId);
    console.log("User ID:", req.body.userId);

    // Check if commentId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.commentId)) {
      return next(errorHandler(400, "Invalid comment ID format"));
    }

    const comment = await Comment.findById(req.params.commentId);

    // Add detailed logging
    console.log("Found comment:", comment);

    if (!comment) {
      return next(errorHandler(404, "Comment not found"));
    }

    const userId = req.body.userId;
    if (!userId) {
      return next(errorHandler(400, "User ID is required"));
    }

    const userIdString = userId.toString();
    const userIndex = comment.likes.findIndex(
      (id) => id.toString() === userIdString
    );

    if (userIndex === -1) {
      comment.likes.push(userId);
    } else {
      comment.likes.splice(userIndex, 1);
    }

    comment.numberOfLikes = comment.likes.length;
    await comment.save();

    // Populate the userId field before sending response
    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "username image _id")
      .lean();

    // Log the response
    console.log("Sending populated comment:", populatedComment);

    res.status(200).json(populatedComment);
  } catch (error) {
    console.error("Error in likeComment:", error);
    next(errorHandler(500, "Server error while liking comment"));
  }
};
const editComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return next(errorHandler(404, "Comment not found"));
    }

    const editedComment = await Comment.findByIdAndUpdate(
      req.params.commentId,
      {
        content: req.body.content,
      },
      { new: true }
    ).populate("userId", "username avatar");
    res.status(200).json(editedComment);
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return next(errorHandler(404, "Comment not found"));
    }

    // Remove the comment from the Comment collection
    await Comment.findByIdAndDelete(req.params.commentId);

    // Remove the comment reference from the associated post
    await Post.findOneAndUpdate(
      { slug: comment.slug },
      {
        $pull: { comments: comment._id },
      }
    );

    res.status(200).json("Comment has been deleted");
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.sort === "desc" ? -1 : 1;
    const comments = await Comment.find()
      .sort({ createdAt: sortDirection })
      .skip(startIndex)
      .limit(limit)
      .populate("userId", "username avatar image")
      .populate("slug", "title");
    const totalComments = await Comment.countDocuments();
    const now = new Date();
    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );
    const lastMonthComments = await Comment.countDocuments({
      createdAt: { $gte: oneMonthAgo },
    });
    res.status(200).json({ comments, totalComments, lastMonthComments });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComment,
  getPostComments,
  likeComment,
  getComments,
  editComment,
  deleteComment,
};
