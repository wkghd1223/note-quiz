export const worlds = [1, 2, 3, 4].map((id) => ({
  id: `w${id}`,
  number: id,
  titleKey: `challenge.world${id}.title`,
  objectiveKey: `challenge.world${id}.objective`,
  stageIds: Array.from({ length: 6 }, (_, i) => `w${id}-s${i + 1}`),
}));
