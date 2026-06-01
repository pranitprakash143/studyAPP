import { NextRequest, NextResponse } from "next/server";

// A curated dictionary of ultra-premium, high-resolution Unsplash photos for news domains
const THEME_IMAGES: Record<string, string[]> = {
  polity: [
    "photo-1541872703-74c5e44368f9", // Indian parliament-style architecture
    "photo-1589829545856-d10d557cf95f", // Gavel & law books
    "photo-1529107386315-e1a2ed48a620", // Constitutional documents/files
    "photo-1450133064473-71024230f91b", // Supreme Court pillars/columns
  ],
  economy: [
    "photo-1590283603385-17ffb3a7f29f", // Dynamic stock graphs/charts
    "photo-1526304640581-d334cdbbf45e", // Indian rupee bills / digital transactions
    "photo-1611974789855-9c2a0a7236a3", // Modern trading terminals
    "photo-1559526324-4b87b5e36e44", // Business growth meeting/analytics
  ],
  science: [
    "photo-1451187580459-43490279c0fa", // Digital globe / network tech
    "photo-1518770660439-4636190af475", // Silicon microchip hardware
    "photo-1618005182384-a83a8bd57fbe", // Colorful AI neural network style art
    "photo-1614064641938-3bbee52942c7", // Cybersecurity digital lock grid
  ],
  environment: [
    "photo-1470071459604-3b5ec3a7fe05", // Misty mountain forests
    "photo-1500485035595-cbe6f645feb1", // Wind turbines / renewable energy
    "photo-1464822759023-fed622ff2c3b", // Glorious Himalayan-style peaks
    "photo-1441974231531-c6227db76b6e", // Lush sunlight shining through trees
  ],
  international: [
    "photo-1517048676732-d65bc937f952", // Global summit meeting / national flags
    "photo-1526256262350-7da7584cf5eb", // Diplomatic assembly hallway
    "photo-1521791136364-72864728e065", // Business/global handshake
    "photo-1540910419892-4a36d2c3266c", // International court / official hall
  ],
  assam: [
    "photo-1597481499750-3e6b22637e12", // Lush green Assam tea gardens
    "photo-1595841696660-3340b33b7ed4", // Scenic riverbank sunrise (Brahmaputra feel)
    "photo-1588613254911-37d4576df6c9", // Indian Rhino (Kaziranga feel)
    "photo-1506477331477-33d5d8b3dc85", // Scenic tropical greenery
  ],
  defense: [
    "photo-1507679799987-c73779587ccf", // Strategic control dashboard
    "photo-1601584115197-04ecc0da31d7", // Modern military aircrafts / radar
    "photo-1517059224940-d4af9eec41b7", // Tactical navigation map
  ],
  social: [
    "photo-1584515979956-d9f6e5d09982", // Healthcare / vaccine vial setup
    "photo-1509062522246-3755977927d7", // Classroom / educational books
    "photo-1544620347-c4fd4a3d5957", // Public transportation / community
  ],
  general: [
    "photo-1504711434969-e33886168f5c", // Premium printed newspaper pile
    "photo-1495020689067-958852a6565d", // Daily news writing desk
    "photo-1505373877841-8d25f7d46678", // Dynamic speech podium
  ]
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.toLowerCase() || "";
    const category = searchParams.get("category")?.toLowerCase() || "";

    let theme = "general";

    // 1. Identify theme by category mapping
    if (category.includes("assam")) {
      theme = "assam";
    } else if (category.includes("polity") || category.includes("govern") || category.includes("law") || category.includes("bill")) {
      theme = "polity";
    } else if (category.includes("econ") || category.includes("financ") || category.includes("bank") || category.includes("tax")) {
      theme = "economy";
    } else if (category.includes("sci") || category.includes("tech") || category.includes("space") || category.includes("comput")) {
      theme = "science";
    } else if (category.includes("environ") || category.includes("climat") || category.includes("wild") || category.includes("forest")) {
      theme = "environment";
    } else if (category.includes("internat") || category.includes("relat") || category.includes("diplom") || category.includes("summit")) {
      theme = "international";
    } else if (category.includes("secur") || category.includes("defen") || category.includes("milit")) {
      theme = "defense";
    } else if (category.includes("social") || category.includes("health") || category.includes("educ")) {
      theme = "social";
    }

    // 2. Scan query text for specific visual overrides
    if (query.includes("assam") || query.includes("kaziranga") || query.includes("brahmaputra") || query.includes("tea")) {
      theme = "assam";
    } else if (query.includes("rupee") || query.includes("stock") || query.includes("gdp") || query.includes("rbi") || query.includes("budget") || query.includes("economy")) {
      theme = "economy";
    } else if (query.includes("isro") || query.includes("space") || query.includes("satellite") || query.includes("nasa") || query.includes("ai") || query.includes("computer")) {
      theme = "science";
    } else if (query.includes("court") || query.includes("constitution") || query.includes("parliament") || query.includes("judge") || query.includes("bill")) {
      theme = "polity";
    } else if (query.includes("summit") || query.includes("china") || query.includes("un ") || query.includes("treaty") || query.includes("agreement")) {
      theme = "international";
    } else if (query.includes("forest") || query.includes("climate") || query.includes("tiger") || query.includes("green") || query.includes("environment")) {
      theme = "environment";
    } else if (query.includes("border") || query.includes("army") || query.includes("missile") || query.includes("defense")) {
      theme = "defense";
    }

    // 3. Select a beautiful high-res image from the resolved theme
    const list = THEME_IMAGES[theme] || THEME_IMAGES.general;
    // Hash query length to make photo selection stable per headline, but feel varied
    const index = Math.abs(query.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % list.length;
    const photoId = list[index];

    const imageUrl = `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=80`;

    return NextResponse.json(
      { success: true, imageUrl, theme, query, category },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
