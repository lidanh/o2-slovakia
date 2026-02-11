"use client";

import { Rate, Typography } from "antd";

interface StarRatingProps {
  rating: number | null;
}

export default function StarRating({ rating }: StarRatingProps) {
  if (rating === null) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  return <Rate disabled value={rating} style={{ fontSize: 16 }} />;
}
