/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/voting.json`.
 */
export type Voting = {
  "address": "H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7",
  "metadata": {
    "name": "voting",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initializeCounter",
      "discriminator": [
        67,
        89,
        100,
        87,
        231,
        172,
        35,
        124
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializePoll",
      "discriminator": [
        193,
        22,
        99,
        197,
        18,
        33,
        115,
        117
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "pollAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "counter.next_poll_id",
                "account": "globalPollCounter"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "startTime",
          "type": "u64"
        },
        {
          "name": "endTime",
          "type": "u64"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "candidates",
          "type": {
            "vec": "string"
          }
        },
        {
          "name": "tallierPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "publishResults",
      "discriminator": [
        198,
        64,
        157,
        180,
        215,
        21,
        224,
        119
      ],
      "accounts": [
        {
          "name": "publisher",
          "writable": true,
          "signer": true
        },
        {
          "name": "pollAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "pollId"
              }
            ]
          }
        },
        {
          "name": "resultsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  117,
                  108,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "pollId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pollId",
          "type": "u64"
        },
        {
          "name": "results",
          "type": {
            "vec": {
              "defined": {
                "name": "candidateResult"
              }
            }
          }
        }
      ]
    },
    {
      "name": "registerVoter",
      "discriminator": [
        229,
        124,
        185,
        99,
        118,
        51,
        226,
        6
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "pollAccount"
          ]
        },
        {
          "name": "pollAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "pollId"
              }
            ]
          }
        },
        {
          "name": "voter"
        },
        {
          "name": "voterRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "pollId"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pollId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "vote",
      "discriminator": [
        227,
        110,
        155,
        23,
        136,
        126,
        172,
        25
      ],
      "accounts": [
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "pollAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "pollId"
              }
            ]
          }
        },
        {
          "name": "voterRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "pollId"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "voteAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "pollId"
              },
              {
                "kind": "arg",
                "path": "nullifier"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pollId",
          "type": "u64"
        },
        {
          "name": "nullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "encryptedVote",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalPollCounter",
      "discriminator": [
        126,
        146,
        208,
        153,
        188,
        143,
        250,
        173
      ]
    },
    {
      "name": "pollAccount",
      "discriminator": [
        109,
        254,
        117,
        41,
        232,
        74,
        172,
        45
      ]
    },
    {
      "name": "resultsAccount",
      "discriminator": [
        111,
        151,
        236,
        89,
        194,
        158,
        227,
        232
      ]
    },
    {
      "name": "voteAccount",
      "discriminator": [
        203,
        238,
        154,
        106,
        200,
        131,
        0,
        41
      ]
    },
    {
      "name": "voterRegistry",
      "discriminator": [
        146,
        143,
        24,
        89,
        70,
        216,
        173,
        189
      ]
    }
  ],
  "events": [
    {
      "name": "pollCreatedEvent",
      "discriminator": [
        11,
        163,
        79,
        30,
        241,
        11,
        74,
        234
      ]
    },
    {
      "name": "resultsPublishedEvent",
      "discriminator": [
        56,
        234,
        167,
        13,
        133,
        219,
        240,
        76
      ]
    },
    {
      "name": "voteCastEvent",
      "discriminator": [
        241,
        151,
        159,
        134,
        250,
        234,
        71,
        234
      ]
    },
    {
      "name": "voterRegisteredEvent",
      "discriminator": [
        116,
        128,
        57,
        40,
        110,
        56,
        101,
        38
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "votingNotStarted",
      "msg": "Voting has not started yet"
    },
    {
      "code": 6001,
      "name": "votingEnded",
      "msg": "Voting has ended"
    },
    {
      "code": 6002,
      "name": "voterNotRegistered",
      "msg": "Voter is not registered for this poll"
    },
    {
      "code": 6003,
      "name": "alreadyVoted",
      "msg": "Voter has already voted"
    },
    {
      "code": 6004,
      "name": "tooManyCandidates",
      "msg": "Cannot have more than 10 candidates"
    },
    {
      "code": 6005,
      "name": "noCandidates",
      "msg": "Poll must have at least one candidate"
    },
    {
      "code": 6006,
      "name": "invalidStartTime",
      "msg": "Start time cannot be in the past"
    },
    {
      "code": 6007,
      "name": "invalidTimeRange",
      "msg": "End time must be after start time"
    },
    {
      "code": 6008,
      "name": "votingNotEnded",
      "msg": "Voting has not ended yet"
    },
    {
      "code": 6009,
      "name": "invalidTallyCount",
      "msg": "Tally count must match number of candidates"
    },
    {
      "code": 6010,
      "name": "invalidEncryptedVote",
      "msg": "Encrypted vote data is invalid or too small"
    }
  ],
  "types": [
    {
      "name": "candidateResult",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "candidateName",
            "type": "string"
          },
          {
            "name": "voteCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "globalPollCounter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nextPollId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pollAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pollName",
            "type": "string"
          },
          {
            "name": "pollDescription",
            "type": "string"
          },
          {
            "name": "pollVotingStart",
            "type": "u64"
          },
          {
            "name": "pollVotingEnd",
            "type": "u64"
          },
          {
            "name": "candidates",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "tallierPubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "pollCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "candidates",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "startTime",
            "type": "u64"
          },
          {
            "name": "endTime",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "resultsAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "results",
            "type": {
              "vec": {
                "defined": {
                  "name": "candidateResult"
                }
              }
            }
          },
          {
            "name": "totalVotes",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "resultsPublishedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "results",
            "type": {
              "vec": {
                "defined": {
                  "name": "candidateResult"
                }
              }
            }
          },
          {
            "name": "totalVotes",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "voteAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "encryptedVote",
            "type": "bytes"
          },
          {
            "name": "nullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "voteCastEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "voterRegisteredEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "voter",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "voterRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registered",
            "type": "bool"
          },
          {
            "name": "hasVoted",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
