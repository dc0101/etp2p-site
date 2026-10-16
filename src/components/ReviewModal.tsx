import React, { useState } from 'react';
import { Star, CheckCircle2, ShieldCheck, Heart } from 'lucide-react';
import { ReviewSubmission } from '../utils/reputationCalculator.ts';

interface ReviewModalProps {
  traderName: string;
  traderAvatar: string;
  onSubmitReview: (review: ReviewSubmission) => void;
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  traderName,
  traderAvatar,
  onSubmitReview,
  onClose,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [speedRating, setSpeedRating] = useState<number>(5);
  const [commRating, setCommRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('Fast and smooth escrow release! Trustworthy trader.');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitReview({
      rating,
      speedRating,
      communicationRating: commRating,
      comment,
    });
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Reputation Rating Recorded!</h3>
            <p className="text-xs text-slate-400">
              Your feedback directly impacts {traderName}'s global trust rating on TrustPeer.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="text-base font-bold text-white">Rate Your Trading Partner</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">
                &times;
              </button>
            </div>

            <div className="flex items-center gap-3 mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <img
                src={traderAvatar}
                alt={traderName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-700"
              />
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1">
                  {traderName}
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xs text-slate-400">Escrow released successfully</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Star Rating */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5 text-center">
                  Overall Trade Experience
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 text-2xl transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed & Communication Sliders */}
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Release Speed</span>
                    <span className="font-bold text-emerald-400">{speedRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={speedRating}
                    onChange={(e) => setSpeedRating(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Communication &amp; Professionalism</span>
                    <span className="font-bold text-indigo-400">{commRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={commRating}
                    onChange={(e) => setCommRating(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Written Feedback
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  Submit Reputation Review
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
