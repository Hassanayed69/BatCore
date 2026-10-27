export function planExerciseKey(index) {
  return `plan:${index}`;
}

export function customExerciseKey(id) {
  return `custom:${id}`;
}

export function sessionStats(session, day) {
  let totalSets = 0;
  let doneSets = 0;
  let exerciseCount = 0;

  (day?.ex || []).forEach((exercise, index) => {
    exerciseCount += 1;
    totalSets += Number(exercise.sets) || 0;
    const logs = session?.logs?.[planExerciseKey(index)] || [];
    doneSets += logs.filter((set) => set?.done).length;
  });

  (session?.custom || []).forEach((exercise) => {
    exerciseCount += 1;
    totalSets += Number(exercise.sets) || 0;
    const logs = session?.logs?.[customExerciseKey(exercise.id)] || [];
    doneSets += logs.filter((set) => set?.done).length;
  });

  return {
    totalSets,
    doneSets: Math.min(doneSets, totalSets),
    exerciseCount,
    percent: totalSets ? Math.min(100, Math.round((doneSets / totalSets) * 100)) : 0,
    completed: Boolean(session?.completed)
  };
}
