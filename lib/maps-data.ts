// Auto-generated Dragon Con 2026 venue maps and room coordinate definitions
export interface RoomCoordinate {
  x: number;
  y: number;
}

export interface VenueBooth {
  id: string;
  name: string;
  boothType?: string;
  placeId: string;
  coordinates: RoomCoordinate[];
}

export interface VenueMapInfo {
  id: string;
  name: string;
  slug: string;
  officialUrl: string;
  imgUrl: string | null;
  localPath: string | null;
  width: number;
  height: number;
  booths: VenueBooth[];
}

export const VENUE_MAPS: VenueMapInfo[] = [
  {
    "id": "ddb23083ea798277e1a6848822d0f72e",
    "name": "AmericasMart Building 2",
    "slug": "americasmart-b2",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/ddb23083ea798277e1a6848822d0f72e",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/ddb23083ea798277e1a6848822d0f72e.3930.png",
    "localPath": "/maps/americasmart-b2.png",
    "width": 1024,
    "height": 1886,
    "booths": []
  },
  {
    "id": "f902827d8d0144dab61b3b975f83e7e4",
    "name": "AmericasMart Building 3",
    "slug": "americasmart-b3",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/f902827d8d0144dab61b3b975f83e7e4",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/f902827d8d0144dab61b3b975f83e7e4.3931.png",
    "localPath": "/maps/americasmart-b3.png",
    "width": 1024,
    "height": 2048,
    "booths": []
  },
  {
    "id": "c8f6368dbb2565204cf6e597e16111bd",
    "name": "Aquarium Shuttle",
    "slug": "aquarium-shuttle",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/c8f6368dbb2565204cf6e597e16111bd",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/c8f6368dbb2565204cf6e597e16111bd.3942.png",
    "localPath": "/maps/aquarium-shuttle.png",
    "width": 1275,
    "height": 1650,
    "booths": []
  },
  {
    "id": "dd681042980232a4ae10f8beec324451",
    "name": "Convention Footprint",
    "slug": "convention-footprint",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/dd681042980232a4ae10f8beec324451",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/dd681042980232a4ae10f8beec324451.3943.png",
    "localPath": "/maps/convention-footprint.png",
    "width": 996,
    "height": 708,
    "booths": []
  },
  {
    "id": "89f522b784d6e4ad8504a2120c20b67a",
    "name": "Courtland Grand",
    "slug": "courtland-grand",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/89f522b784d6e4ad8504a2120c20b67a",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/89f522b784d6e4ad8504a2120c20b67a.3954.png",
    "localPath": "/maps/courtland-grand.png",
    "width": 2134,
    "height": 4267,
    "booths": []
  },
  {
    "id": "c8f6368dbb2565204cf6e597e17f01c5",
    "name": "Hilton",
    "slug": "hilton",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/c8f6368dbb2565204cf6e597e17f01c5",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/c8f6368dbb2565204cf6e597e17f01c5.3955.png",
    "localPath": "/maps/hilton.png",
    "width": 1024,
    "height": 2048,
    "booths": [
      {
        "id": "0da82cff2cf0828d8a324172ea780196",
        "name": "Hilton 301",
        "boothType": "room",
        "placeId": "c8f6368dbb2565204cf6e597e17f01c5",
        "coordinates": [
          {
            "x": 391,
            "y": 1921
          },
          {
            "x": 391,
            "y": 1869
          },
          {
            "x": 428,
            "y": 1869
          },
          {
            "x": 428,
            "y": 1921
          },
          {
            "x": 388,
            "y": 1919
          }
        ]
      },
      {
        "id": "7cd2a47c9f6a22b0c89a800fdc3efd41",
        "name": "Hilton Grand West",
        "boothType": "room",
        "placeId": "c8f6368dbb2565204cf6e597e17f01c5",
        "coordinates": [
          {
            "x": 271,
            "y": 929
          },
          {
            "x": 271,
            "y": 1101
          },
          {
            "x": 341,
            "y": 1101
          },
          {
            "x": 341,
            "y": 929
          }
        ]
      },
      {
        "id": "872e5b32e0d899f4af5cf3752bec391c",
        "name": "Hilton Grand Salon",
        "boothType": "room",
        "placeId": "c8f6368dbb2565204cf6e597e17f01c5",
        "coordinates": [
          {
            "x": 312,
            "y": 1301
          },
          {
            "x": 312,
            "y": 1454
          },
          {
            "x": 496,
            "y": 1454
          },
          {
            "x": 496,
            "y": 1301
          }
        ]
      },
      {
        "id": "937a9c0e7139b916bb01bea246911d07",
        "name": "Hilton 202",
        "boothType": "room",
        "placeId": "c8f6368dbb2565204cf6e597e17f01c5",
        "coordinates": [
          {
            "x": 167,
            "y": 1345
          },
          {
            "x": 148,
            "y": 1375
          },
          {
            "x": 208,
            "y": 1413
          },
          {
            "x": 227,
            "y": 1383
          },
          {
            "x": 166,
            "y": 1343
          }
        ]
      }
    ]
  },
  {
    "id": "c8f6368dbb2565204cf6e597e19e7e08",
    "name": "Hyatt",
    "slug": "hyatt",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/c8f6368dbb2565204cf6e597e19e7e08",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/c8f6368dbb2565204cf6e597e19e7e08.3961.png",
    "localPath": "/maps/hyatt.png",
    "width": 1024,
    "height": 2048,
    "booths": [
      {
        "id": "0538803fd6bd6b30f5f8acffc0b52d39",
        "name": "Hyatt International South",
        "boothType": "room",
        "placeId": "c8f6368dbb2565204cf6e597e19e7e08",
        "coordinates": [
          {
            "x": 200,
            "y": 1597
          },
          {
            "x": 395,
            "y": 1597
          },
          {
            "x": 395,
            "y": 1697
          },
          {
            "x": 307,
            "y": 1697
          },
          {
            "x": 307,
            "y": 1689
          },
          {
            "x": 214,
            "y": 1689
          },
          {
            "x": 213,
            "y": 1684
          },
          {
            "x": 205,
            "y": 1684
          },
          {
            "x": 205,
            "y": 1693
          },
          {
            "x": 183,
            "y": 1692
          },
          {
            "x": 183,
            "y": 1637
          },
          {
            "x": 207,
            "y": 1635
          },
          {
            "x": 207,
            "y": 1641
          },
          {
            "x": 216,
            "y": 1642
          },
          {
            "x": 216,
            "y": 1636
          },
          {
            "x": 204,
            "y": 1633
          },
          {
            "x": 206,
            "y": 1623
          },
          {
            "x": 199,
            "y": 1621
          },
          {
            "x": 199,
            "y": 1597
          }
        ]
      },
      {
        "id": "0da82cff2cf0828d8a324172ea97743d",
        "name": "Hyatt Centennial I",
        "boothType": "room",
        "placeId": "c8f6368dbb2565204cf6e597e19e7e08",
        "coordinates": [
          {
            "x": 528,
            "y": 1381
          },
          {
            "x": 528,
            "y": 1539
          },
          {
            "x": 634,
            "y": 1539
          },
          {
            "x": 634,
            "y": 1381
          }
        ]
      },
      {
        "id": "937a9c0e7139b916bb01bea246b06008",
        "name": "Hyatt Centennial II-IV",
        "boothType": "room",
        "placeId": "c8f6368dbb2565204cf6e597e19e7e08",
        "coordinates": [
          {
            "x": 636,
            "y": 1382
          },
          {
            "x": 636,
            "y": 1539
          },
          {
            "x": 966,
            "y": 1539
          },
          {
            "x": 966,
            "y": 1382
          }
        ]
      }
    ]
  },
  {
    "id": "f902827d8d0144dab61b3b975fa2187e",
    "name": "Marriott",
    "slug": "marriott",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/f902827d8d0144dab61b3b975fa2187e",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/f902827d8d0144dab61b3b975fa2187e.3967.png",
    "localPath": "/maps/marriott.png",
    "width": 1024,
    "height": 2048,
    "booths": [
      {
        "id": "811999c50cc38c724c4f10b6afd91434",
        "name": "Marriott Atrium Ballroom",
        "boothType": "room",
        "placeId": "f902827d8d0144dab61b3b975fa2187e",
        "coordinates": [
          {
            "x": 727,
            "y": 1675.199951171875
          },
          {
            "x": 726,
            "y": 1812.199951171875
          },
          {
            "x": 749,
            "y": 1813.199951171875
          },
          {
            "x": 749,
            "y": 1803.199951171875
          },
          {
            "x": 782,
            "y": 1790.199951171875
          },
          {
            "x": 824,
            "y": 1779.199951171875
          },
          {
            "x": 875,
            "y": 1781.199951171875
          },
          {
            "x": 912,
            "y": 1790.199951171875
          },
          {
            "x": 932,
            "y": 1800.199951171875
          },
          {
            "x": 940,
            "y": 1800.199951171875
          },
          {
            "x": 940,
            "y": 1813.199951171875
          },
          {
            "x": 968,
            "y": 1816.199951171875
          },
          {
            "x": 968,
            "y": 1791.199951171875
          },
          {
            "x": 1008,
            "y": 1790.199951171875
          },
          {
            "x": 1008,
            "y": 1675.199951171875
          },
          {
            "x": 724,
            "y": 1676.199951171875
          }
        ]
      },
      {
        "id": "862e3877f75c2a2407fa0b918b4a48d9",
        "name": "Marriott Imperial Ballroom",
        "boothType": "room",
        "placeId": "f902827d8d0144dab61b3b975fa2187e",
        "coordinates": [
          {
            "x": 654,
            "y": 861
          },
          {
            "x": 712,
            "y": 860
          },
          {
            "x": 713,
            "y": 871
          },
          {
            "x": 762,
            "y": 877
          },
          {
            "x": 820,
            "y": 870
          },
          {
            "x": 819,
            "y": 881
          },
          {
            "x": 880,
            "y": 884
          },
          {
            "x": 880,
            "y": 985
          },
          {
            "x": 655,
            "y": 985
          },
          {
            "x": 655,
            "y": 861
          }
        ]
      }
    ]
  },
  {
    "id": "4034025ec46b2d164914cb943651aef2",
    "name": "Parade Shuttle",
    "slug": "parade-shuttle",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/4034025ec46b2d164914cb943651aef2",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/4034025ec46b2d164914cb943651aef2.3978.png",
    "localPath": "/maps/parade-shuttle.png",
    "width": 1275,
    "height": 1650,
    "booths": []
  },
  {
    "id": "ddb23083ea798277e1a6848822f0329b",
    "name": "Shuttles",
    "slug": "shuttles",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/ddb23083ea798277e1a6848822f0329b",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/ddb23083ea798277e1a6848822f0329b.3984.png",
    "localPath": "/maps/shuttles.png",
    "width": 1289,
    "height": 1650,
    "booths": []
  },
  {
    "id": "f902827d8d0144dab61b3b975fc1de46",
    "name": "Westin",
    "slug": "westin",
    "officialUrl": "https://app.core-apps.com/dragoncon26/places/f902827d8d0144dab61b3b975fc1de46",
    "imgUrl": "https://static.coreapps.net/dragoncon26/maps/f902827d8d0144dab61b3b975fc1de46.3985.png",
    "localPath": "/maps/westin.png",
    "width": 1024,
    "height": 2048,
    "booths": []
  }
];
