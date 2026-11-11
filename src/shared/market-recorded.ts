export const recordedMarket = {
  "schema": "escrowpal.market-analysis.v1",
  "createdAt": "2026-11-10T05:20:29.210Z",
  "input": {
    "title": "Sweet Crumb · neighborhood launch",
    "objective": "Choose a small, measurable launch channel for a fictional bakery website. Prioritize local reach and a testable response over broad exposure.",
    "audience": "Neighbors within five miles of a fictional bakery",
    "budget": 1200,
    "fictional": true,
    "options": [
      {
        "id": "newsletter",
        "label": "Neighborhood newsletter",
        "channel": "email",
        "offer": "A sponsored issue with a tracked menu link and a simple discount code.",
        "quotedPrice": 240,
        "sourceUrl": "https://example.com/fictional-newsletter-quote",
        "observedOn": "2026-11-10",
        "impressions": 2400,
        "clicks": 96
      },
      {
        "id": "social",
        "label": "Local social creator",
        "channel": "creator",
        "offer": "One launch post with a tracked link; broad local followers, uncertain purchase intent.",
        "quotedPrice": 480,
        "sourceUrl": "https://example.com/fictional-creator-quote",
        "observedOn": "2026-11-10",
        "impressions": 8000,
        "clicks": 80
      },
      {
        "id": "search",
        "label": "Neighborhood search pilot",
        "channel": "search",
        "offer": "A short local search test with a dedicated landing page and weekly report.",
        "quotedPrice": 360,
        "sourceUrl": "https://example.com/fictional-search-quote",
        "observedOn": "2026-11-10",
        "impressions": 3000,
        "clicks": 90
      }
    ]
  },
  "evidence": {
    "sourceCount": 3,
    "candidateCount": 3,
    "freshSourceCount": 3,
    "flags": [
      "All sample observations and source links are fictional.",
      "Source references are supplied by the user; this pipeline has not independently verified their contents."
    ],
    "policyBlocks": [],
    "verifiedSources": false
  },
  "signals": {
    "minQuotedPrice": 240,
    "medianQuotedPrice": 360,
    "maxQuotedPrice": 480,
    "affordableCandidateIds": [
      "newsletter",
      "social",
      "search"
    ],
    "observedCtr": [
      {
        "id": "newsletter",
        "percent": 4,
        "sampleImpressions": 2400
      },
      {
        "id": "social",
        "percent": 1,
        "sampleImpressions": 8000
      },
      {
        "id": "search",
        "percent": 3,
        "sampleImpressions": 3000
      }
    ]
  },
  "decision": {
    "status": "suggested",
    "choiceId": "search",
    "optionOrderStable": true,
    "largestOrderChangePoints": 9.62,
    "engine": "Laya",
    "runtime": "onnx-cpu",
    "revision": "68f27dfe5a27a54fb2b1fefc432f43f972e90868",
    "listed": {
      "choice": "search",
      "probabilities": {
        "newsletter": 0.2627,
        "social": 0.2886,
        "search": 0.4487
      }
    },
    "reversed": {
      "choice": "search",
      "probabilities": {
        "search": 0.3525,
        "social": 0.3343,
        "newsletter": 0.3133
      }
    },
    "elapsedMs": 30336,
    "reason": "Both option orders selected the same pilot. This preference is advisory; it does not predict sales or authorize payment.",
    "stateExcerpt": "{\"objective\":\"Choose a small, measurable launch channel for a fictional bakery website. Prioritize local reach and a testable response over broad exposure.\",\"audience\":\"Neighbors within five miles of a fictional bakery\",\"budgetUSD\":1200,\"candidates\":[{\"id\":\"newsletter\",\"channel\":\"email\",\"quoteUSD\":240,\"claim\":\"A sponsored issue with a tracked menu link and a simple discount code.\",\"impressions\":2400,\"clicks\":96},{\"id\":\"social\",\"channel\":\"creator\",\"quoteUSD\":480,\"claim\":\"One launch post with a tracked link; broad local followers, uncertain purchase intent.\",\"impressions\":8000,\"clicks\":80},{\"id\":\"search\",\"channel\":\"search\",\"quoteUSD\":360,\"claim\":\"A short local search test with a dedicated landing page and weekly report.\",\"impressions\":3000,\"clicks\":90}],\"scope\":\"Unverified user claims. Compare pilot suitability, not expected sales. No payment authority.\"}",
    "usage": {
      "input_tokens": 616,
      "output_tokens": 0
    }
  },
  "benchmark": {
    "schema": "escrowpal.research-evidence.v1",
    "status": "historical-private-research",
    "task": "Aggregate delayed brand recall",
    "gpuTrainingVerified": true,
    "accelerator": "Tesla T4",
    "epochsCompleted": 4,
    "trainingProgramSeconds": 627.611754725,
    "peakGpuMemoryBytes": 8337315840,
    "heldOutAds": 605,
    "heldOutAdvertiserGroups": 58,
    "meanAbsoluteErrorPercentagePoints": 20.750592948518257,
    "accuracyPercent": null,
    "checkpointDistributed": false,
    "servingCheckpoint": "Separate public pretrained Laya decision model",
    "resultScope": "One exploratory recall-regression experiment; not market-choice accuracy, sales, profit, or prospective campaign validation.",
    "sourcePredictionsSealVerified": true,
    "creativeTextIncrementalBenefitDemonstrated": false,
    "weightsResearchOnly": true,
    "currentMarketDecisionAccuracy": null
  },
  "stages": [
    "Validate declared evidence",
    "Compute observed signals",
    "Compare choices with Laya",
    "Review pilot terms",
    "Authorize PayPal sandbox milestones"
  ],
  "paymentPolicy": {
    "automaticCapture": false,
    "currency": "USD",
    "budget": 1200,
    "sellerMustAccept": true,
    "humanDecisionRequired": true
  },
  "inferenceMode": "recorded",
  "recordedExampleNotice": "Recorded fictional comparison, captured before local inference was disabled. No live model runs when this example opens."
};
