const express = require("express");
const app = express();
const path = require("path");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
app.use(express.json());

const covidData = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initialization = async () => {
  try {
    db = await open({ filename: covidData, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server started successfully..");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initialization();

// middleware function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "surya_k", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT *
    FROM
    user
    WHERE
    username = '${username}';`;
  const getUser = await db.get(getUserQuery);

  if (getUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordOk = await bcrypt.compare(password, getUser.password);
    if (isPasswordOk) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "surya_k");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2

app.get("/states/", authenticateToken, async (request, response) => {
  const stateQuery = `SELECT *
    FROM
    state
    ORDER BY
    state_id;`;
  const states = await db.all(stateQuery);
  response.send(
    states.map((e) => {
      return {
        stateId: e["state_id"],
        stateName: e["state_name"],
        population: e["population"],
      };
    })
  );
});

// API 3

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `SELECT *
    FROM
    state
    WHERE
    state_id = ${stateId};`;
  const selectState = await db.get(selectStateQuery);
  response.send({
    stateId: selectState["state_id"],
    stateName: selectState["state_name"],
    population: selectState["population"],
  });
});

// API 4

app.post("/districts/", async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `INSERT INTO
  district (district_name,state_id,cases,
    cured,active,deaths)
    VALUES 
    (
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths});`;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// API 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district
    WHERE
    district_id = ${districtId} ;`;
    const getDistrict = await db.get(getDistrictQuery);
    response.send({
      districtId: getDistrict["district_id"],
      districtName: getDistrict["district_name"],
      stateId: getDistrict["state_id"],
      cases: getDistrict["cases"],
      cured: getDistrict["cured"],
      active: getDistrict["active"],
      deaths: getDistrict["deaths"],
    });
  }
);

// API 6

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const removeDistrictQuery = `DELETE 
    FROM
    district
    WHERE
    district_id = ${districtId}; `;
    const removeDistrict = await db.run(removeDistrictQuery);
    response.send("District Removed");
  }
);

// API 7

app.put("/districts/:districtId/", async (request, response) => {
  const districtDetails = request.body;
  const { districtId } = request.params;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const updateDistrictQuery = `UPDATE
  district 
    
  SET 
    
    district_name ='${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    
    WHERE
    district_id = ${districtId};`;

  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

// API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const allDetailsQuery = `SELECT 
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
    
    FROM
    district
    
    WHERE
    state_id = ${stateId};`;

    const API8 = await db.get(allDetailsQuery);
    response.send({
      totalCases: API8["SUM(cases)"],
      totalCured: API8["SUM(cured)"],
      totalActive: API8["SUM(active)"],
      totalDeaths: API8["SUM(deaths)"],
    });
  }
);
