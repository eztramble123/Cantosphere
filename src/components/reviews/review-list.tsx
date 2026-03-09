import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import type { ReviewWithUser } from "@/types";

interface ReviewListProps {
  reviews: ReviewWithUser[];
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No reviews yet. Be the first to review this app.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="border-b pb-4 last:border-0">
          <div className="flex items-center gap-3 mb-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={review.user.image || undefined} />
              <AvatarFallback>
                {(review.user.name || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {review.user.name || review.user.username}
              </p>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-3 w-3 ${
                      star <= review.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          {review.title && (
            <p className="text-sm font-medium">{review.title}</p>
          )}
          {review.body && (
            <p className="text-sm text-muted-foreground">{review.body}</p>
          )}
        </div>
      ))}
    </div>
  );
}
