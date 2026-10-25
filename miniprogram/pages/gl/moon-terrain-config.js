export const TERRAIN_CONFIG = {
  "shot": {
    "start": 193,
    "end": 271.7266666666667,
    "width": 540,
    "height": 960,
    "moonRadius": 650,
    "blendEdge": 12,
    "keyframes": [
      193,
      205,
      216,
      228,
      233,
      237,
      241,
      245,
      250,
      255,
      263,
      271.7266666666667
    ],
    "phases": [
      [
        193,
        "第二圈 · 远景接近"
      ],
      [
        205,
        "下降 · 展开大环形山"
      ],
      [
        216,
        "完整大坑 · 人物尚不可辨"
      ],
      [
        228,
        "沿坑缘外侧靠近高脊"
      ],
      [
        234,
        "先看三人 · 望向画外"
      ],
      [
        239,
        "顺着他们的视线转向"
      ],
      [
        241,
        "远地球入画 · 三人同望"
      ],
      [
        255,
        "慢慢前行 · 一直到曲终"
      ]
    ],
    "audio": {
      "file": "../descent-to-earth-193/assets/moon-tail-193.wav",
      "sourceStart": 193,
      "sha1": "b6907476df6166a35745ebfeebab0d20f550fe4f",
      "clock": "sourceStart + HTMLAudioElement.currentTime (exact decoded PCM tail)",
      "sourceFile": "../descent-to-earth-193/assets/Zen-moon.mp3"
    },
    "crewLayout": {
      "metersPerUnit": 25,
      "scaleMeaning": "Art-directed compromise: human silhouettes enlarged about 2.5x over normal; terrain at a designed local scale",
      "representativeCraterCrossSectionUnits": 55,
      "representativeCraterCrossSectionMeters": 1375,
      "center": [
        61.25,
        7.5709698566618755,
        -3.85
      ],
      "seatOffset": 0.0004,
      "seats": [
        {
          "kind": "rei",
          "x": 61.18,
          "z": -3.85,
          "scale": 0.05,
          "groundY": 7.57171285700305,
          "seatedHeightMeters": 2.8875
        },
        {
          "kind": "shinji",
          "x": 61.25,
          "z": -3.85,
          "scale": 0.05125,
          "groundY": 7.5709698566618755,
          "seatedHeightMeters": 2.9596875
        },
        {
          "kind": "asuka",
          "x": 61.32,
          "z": -3.85,
          "scale": 0.05,
          "groundY": 7.556280758966295,
          "seatedHeightMeters": 2.8875
        }
      ]
    }
  },
  "anchor": {
    "moonRadius": 650,
    "moonCenter": [
      0,
      -650,
      0
    ],
    "originalTime": 193,
    "originalPosition": [
      -5.247038465439611,
      4.2,
      -7.637685090477128
    ],
    "originalQuaternion": [
      -0.010921364551038912,
      0.9525933545957361,
      0.3020937311931725,
      0.03443838193313771
    ],
    "rigidRotation": [
      0.1452897368598418,
      0.27836521847727563,
      0.13478854750635788,
      0.9398062273503102
    ],
    "scale": 722.2222222222222,
    "position": [
      -3451.82460406436,
      4169.5714187454305,
      -3263.9779139318644
    ],
    "quaternion": [
      -0.049566710113250326,
      0.859476420915731,
      0.42999363515103944,
      -0.27193546452794476
    ],
    "up": [
      -0.172463013956965,
      0.9214458796486484,
      0.3481292858916184
    ],
    "earthPosition": [
      -1.282924384011292e-12,
      994.8718780409795,
      -20517.016499029927
    ],
    "earthRadius": 848.1022689589122,
    "sunDirection": [
      0.8853212746988635,
      0.38999999999999985,
      0.2531921020995309
    ]
  },
  "calibration": {
    "referenceTime": 255,
    "reference": "WeChat DevTools actual framebuffer and scene pose",
    "earthQuaternionAtReference": [
      -0.010125575860941094,
      0.9572881619673171,
      0.27887299751085554,
      -0.0756749557649667
    ],
    "sunDirection": [
      0.9248998598178239,
      0.3052196536199543,
      0.22671835468943383
    ],
    "sunInEarthView": [
      0.9243389912987644,
      0.3155345414827806,
      0.21455857544277623
    ],
    "earthInEarthView": [
      -0.00857036114036712,
      0.963825124140023,
      0.25579008821874993,
      -0.07442519570304693
    ],
    "cloudOpacity": 0.58,
    "earthAngularSpeed": 0.009,
    "cloudAngularSpeed": 0.00035
  },
  "crop": {
    "originalSize": [
      8192,
      8192
    ],
    "crop": [
      6062,
      3358,
      7373,
      4506
    ],
    "size": [
      1311,
      1148
    ],
    "resized": false,
    "uvOrigin": [
      0.739990234375,
      0.409912109375
    ],
    "uvExtent": [
      0.1600341796875,
      0.14013671875
    ]
  }
};
