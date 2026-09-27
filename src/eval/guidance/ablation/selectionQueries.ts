export const selectionQueries = [
  {
    id: "schema-changes",
    taskText: "How should database schema changes be generated?",
    intended: "profile/generate-schema-changes-with-tooling",
    allowed: ["profile/generate-schema-changes-with-tooling"],
  },
  {
    id: "cache-invalidation",
    taskText: "Explain when the response cache is invalidated.",
    intended: "reference/reference_response_cache_invalidation",
    allowed: ["reference/reference_response_cache_invalidation"],
  },
  {
    id: "deployment-rollback",
    taskText: "Explain how a failed deployment is rolled back.",
    intended: "reference/reference_deployment_rollback",
    allowed: ["reference/reference_deployment_rollback"],
  },
  {
    id: "log-retention",
    taskText: "Investigate why application logs expire early.",
    intended: "reference/reference_log_retention_window",
    allowed: ["reference/reference_log_retention_window"],
  },
  {
    id: "feature-flags",
    taskText: "Explain how feature flags reach the background worker.",
    intended: "reference/reference_feature_flag_delivery",
    allowed: [
      "reference/reference_feature_flag_delivery",
      "reference/reference_worker_configuration",
    ],
  },
  {
    id: "retry-backoff",
    taskText: "Keep retry backoff state across worker restarts.",
    intended: "reference/keep-retry-state-across-restarts",
    allowed: ["reference/keep-retry-state-across-restarts"],
  },
  {
    id: "photo-rotation",
    taskText: "Rotate a landscape photo clockwise.",
    intended: null,
    allowed: [],
  },
  {
    id: "poetry-translation",
    taskText: "Translate a haiku into Spanish.",
    intended: null,
    allowed: [],
  },
  {
    id: "soup-ingredients",
    taskText: "Suggest ingredients for lentil soup.",
    intended: null,
    allowed: [],
  },
  {
    id: "lunar-eclipse",
    taskText: "Explain lunar eclipses to a child.",
    intended: null,
    allowed: [],
  },
  {
    id: "piano-transcription",
    taskText: "Transcribe an acoustic piano melody.",
    intended: null,
    allowed: [],
  },
  {
    id: "chess-notation",
    taskText: "Describe chess castling notation.",
    intended: null,
    allowed: [],
  },
] as const;
