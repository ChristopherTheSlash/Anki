export type Deck = {
  id: number;
  name: string;
  card_count: number;
  total_cards: number;
  total_including_children: number;
  due_count: number;
  new_count: number;
  learn_count: number;
  review_count: number;
};

export type ReviewCard = {
  card_id: number;
  note_id: number;
  deck_id: number;
  question_html: string;
  answer_html: string;
  buttons: number[];
};

export type Settings = {
  apiUrl: string;
  token: string;
};

export type SessionStats = {
  answered: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
};
