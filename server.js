const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");

const app = express();
const port = 3000;

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(
  session({
    secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
    resave: false,
    saveUninitialized: true,
  })
);

const db = new sqlite3.Database("./election.db");

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS auth(id INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(50) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, user_id INTEGER)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS roles(id INTEGER PRIMARY KEY AUTOINCREMENT, role VARCHAR(50) NOT NULL)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, first_name VARCHAR(50) NOT NULL, middle_name VARCHAR(50) NULL, last_name VARCHAR(50) NOT NULL, DOB DATE NOT NULL, profile_picture BLOB NOT NULL, role_id INTEGER, has_voted INTEGER)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS parties(id INTEGER PRIMARY KEY AUTOINCREMENT, party VARCHAR(50) NOT NULL, logo BLOB)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS positions(id INTEGER PRIMARY KEY AUTOINCREMENT, posi''tion VARCHAR(50) NOT NULL)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS candidates(id INTEGER PRIMARY KEY AUTOINCREMENT, first_name VARCHAR(50) NOT NULL, middle_name VARCHAR(50) NULL, last_name VARCHAR(50) NOT NULL, party_id INTEGER NOT NULL, position_id INTEGER NOT NULL, photo BLOB)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS votes(id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL UNIQUE, vote INTEGER NOT NULL)"
  );

  db.run(
    `
    CREATE TABLE IF NOT EXISTS user_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creating user_votes table:", err);
      } else {
        console.log("user_votes table created or already exists.");
      }
    }
  );

  // db.run(
  //   "ALTER TABLE candidates ADD COLUMN votes INTEGER DEFAULT 0"
  // );
});

app.get('/', (req, res) => {
  res.redirect('/login');
})
// Route to render dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const sqlCandidates = `
    SELECT candidates.*, parties.party, parties.logo, positions.position, IFNULL(votes.vote, 0) AS vote
    FROM candidates
    JOIN parties ON candidates.party_id = parties.id
    JOIN positions ON candidates.position_id = positions.id
    LEFT JOIN votes ON candidates.id = votes.candidate_id
  `;

  // SQL to get total votes per position
  const sqlTotalVotesPerPosition = `
    SELECT positions.position, SUM(IFNULL(votes.vote, 0)) AS totalVotes
    FROM candidates
    JOIN positions ON candidates.position_id = positions.id
    LEFT JOIN votes ON candidates.id = votes.candidate_id
    GROUP BY positions.position
  `;

  db.get(
    "SELECT COUNT(username) AS totalUsers FROM auth",
    [],
    (err, result) => {
      if (err) {
        return res.status(500).send("Error fetching total users");
      }
      const totalUsers = result.totalUsers;
      const profilePicture = req.session.profilePicture;

      db.all(sqlTotalVotesPerPosition, [], (err, totalVotesPerPosition) => {
        if (err) {
          return res
            .status(500)
            .send("Error fetching total votes per position");
        }

        const totalVotesMap = {};
        totalVotesPerPosition.forEach((row) => {
          totalVotesMap[row.position] = row.totalVotes || 0;
        });

        db.all(sqlCandidates, [], (err, candidates) => {
          if (err) {
            return res.status(500).send("Error fetching candidates data");
          }

          candidates = candidates.map((candidate) => {
            return {
              ...candidate,
              photo: candidate.photo.toString("base64"),
              logo: candidate.logo.toString("base64"),
              votePercentage:
                totalVotesMap[candidate.position] > 0
                  ? (candidate.vote / totalVotesMap[candidate.position]) * 100
                  : 0,
            };
          });

          // Calculate the overall total votes (sum of all votes across all positions)
          const totalVotes = totalVotesPerPosition.reduce(
            (acc, row) => acc + row.totalVotes,
            0
          );

          res.render("Dashboard", {
            totalUsers,
            profilePicture,
            candidates,
            totalVotes,
          });
        });
      });
    }
  );
});

// Route to render login form
app.get("/login", (req, res) => {
  res.render("Login.ejs");
});

// Route to handle login form submission
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM auth WHERE username = ?", [username], (err, user) => {
    if (err) {
      return res.status(500).send("Internal Server Error");
    }
    if (!user) {
      return res.status(400).send("Invalid Username or Password");
    }

    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        db.get(
          "SELECT * FROM users WHERE id = ?",
          [user.user_id],
          (err, userData) => {
            if (err) {
              return res.status(500).send("Internal Server Error");
            }
            req.session.userId = user.user_id;
            req.session.profilePicture =
              userData.profile_picture.toString("base64");
            res.redirect("/dashboard");
          }
        );
      } else {
        res.status(400).send("Invalid Username or Password");
      }
    });
  });
});

// Route to render voters registration form
app.get("/voters", (req, res) => {
  if (!req.session.userId) {
    res.redirect('login');
  }
  db.all("SELECT * FROM roles", [], (err, roles) => {
    if (err) {
      return res.status(500).send("Error fetching roles");
    }
    res.render("voters", { roles });
  });
});

// Registration route with file upload handling
app.post("/voters", upload.single("photo"), (req, res) => {
  const { firstname, middlename, lastname, dob, username, role, password } =
    req.body;
  const photo = req.file ? req.file.buffer : null;

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return console.error(err.message);
    }

    db.run(
      "INSERT INTO users(first_name, middle_name, last_name, DOB, profile_picture, role_id) VALUES (?,?,?,?,?,?)",
      [firstname, middlename, lastname, dob, photo, role],
      function (err) {
        if (err) {
          return console.error(err.message);
        }
        db.run(
          "INSERT INTO auth(username, password, user_id) VALUES (?,?,?)",
          [username, hashedPassword, this.lastID],
          function (err) {
            if (err) {
              return console.error(err.message);
            }
          }
        );

        console.log(`A row has been inserted with ID ${this.lastID}`);
      }
    );
  });
});

// Route to render party registration form
app.get("/create/party", (req, res) => {
  res.render("Party-Registration");
});

app.post("/create/party", upload.single("logo"), (req, res) => {
  const { party } = req.body;
  const logo = req.file ? req.file.buffer : null;

  db.run(
    "INSERT INTO parties (party, logo) VALUES (?, ?)",
    [party, logo],
    function (err) {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Error saving party information");
      }
      console.log(`A row has been inserted with rowid ${this.lastID}`);
      res.status(200).send("Party created successfully");
    }
  );
});

app.get("/add/position", (req, res) => {
  res.render("Position.ejs");
});

app.post("/add/position", (req, res) => {
  const { Position } = req.body;

  db.run("INSERT INTO positions (position) VALUES (?)", [Position], (err) => {
    if (err) {
      return console.log(err.message);
    }
    console.log("New record has been added");
    res.send("Position has been successfully added");
  });
});

// CANDIDATE REGISTRATION ROUTES

app.get("/candidate/registration", (req, res) => {
  let partiesData, positionsData;

  db.all("SELECT * FROM parties", [], (err, parties) => {
    if (err) {
      return res.status(500).send("Error fetching parties information");
    }
    partiesData = parties;
    checkIfComplete();
  });

  db.all("SELECT * FROM positions", [], (err, positions) => {
    if (err) {
      return res.status(500).send("Error fetching positions information");
    }
    positionsData = positions;
    checkIfComplete();
  });

  function checkIfComplete() {
    if (partiesData && positionsData) {
      res.render("Candidate-Registration", {
        parties: partiesData,
        positions: positionsData,
      });
    }
  }
});

app.post("/candidate/registration", upload.single("photo"), (req, res) => {
  const { firstname, middlename, lastname, party, position } = req.body;
  const photo = req.file ? req.file.buffer : null;

  db.run(
    "INSERT INTO candidates (first_name, middle_name, last_name, party_id, position_id, photo) VALUES (?,?,?,?,?,?)",
    [firstname, middlename, lastname, party, position, photo],
    function (err) {
      if (err) {
        console.error(err.message);
        res.status(500).send("Database error");
      } else {
        console.log(`A row has been inserted with rowid ${this.lastID}`);
        res.status(200).send("Success");
      }
    }
  );
});

// ROUTE FOR USER PROFILE PAGE
app.get("/my/profile", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const sql = `
    SELECT users.*, roles.role, auth.username
    FROM users
    JOIN roles ON users.role_id = roles.id
    JOIN auth ON users.id = auth.user_id
    WHERE users.id = ?
  `;

  db.get(sql, [req.session.userId], (err, user) => {
    if (err) {
      return res.status(500).send("An error occurred");
    }
    if (!user) {
      return res.status(404).send("User not found");
    }

    user.profile_picture = user.profile_picture.toString("base64");

    // Check if the user has voted
    const voteStatus = user.has_voted ? "Voted" : "Not Voted";

    res.render("Profile", { user, voteStatus });
  });
});

// THE MAIN ASPECT OF THE ONLINE PLATFORM, THE VOTING PROCESS
app.get("/vote", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const sql = `
    SELECT candidates.id, candidates.first_name, candidates.last_name, candidates.middle_name, candidates.photo, positions.position, parties.party, IFNULL(votes.vote, 0) AS vote
    FROM candidates
    JOIN positions ON candidates.position_id = positions.id
    JOIN parties ON candidates.party_id = parties.id
    LEFT JOIN votes ON candidates.id = votes.candidate_id
  `;

  db.all(sql, [], (err, candidates) => {
    if (err) {
      return res.status(500).send("Error fetching candidates data");
    }

    candidates = candidates.map((candidate) => {
      return {
        ...candidate,
        photo: candidate.photo.toString("base64"), // Convert photo to base64
      };
    });

    res.render("vote", { candidates });
  });
});

app.post("/vote", (req, res) => {
  const userId = req.session.userId;
  const candidateId1 = req.body.candidateId;
  const candidateId2 = req.body.candidateId2;
  const candidateId3 = req.body.candidateId3;

  const votePromises = [];

  db.get(
    "SELECT * FROM user_votes WHERE user_id = ?",
    [userId],
    (err, userVote) => {
      if (err) {
        console.error("Error checking user vote:", err);
        return res.status(500).send("Error processing votes");
      }

      if (userVote) {
        return res.status(403).send("You have already voted.");
      }

      const handleVote = (candidateId) => {
        return new Promise((resolve, reject) => {
          if (!candidateId) {
            return resolve();
          }

          db.get(
            "SELECT * FROM votes WHERE candidate_id = ?",
            [candidateId],
            (err, vote) => {
              if (err) {
                return reject(err);
              }

              if (vote) {
                db.run(
                  "UPDATE votes SET vote = vote + 1 WHERE candidate_id = ?",
                  [candidateId],
                  (err) => {
                    if (err) {
                      return reject(err);
                    }
                    resolve();
                  }
                );
              } else {
                db.run(
                  "INSERT INTO votes (candidate_id, vote) VALUES (?, 1)",
                  [candidateId],
                  (err) => {
                    if (err) {
                      return reject(err);
                    }
                    resolve();
                  }
                );
              }
            }
          );
        });
      };

      if (candidateId1) votePromises.push(handleVote(candidateId1));
      if (candidateId2) votePromises.push(handleVote(candidateId2));
      if (candidateId3) votePromises.push(handleVote(candidateId3));

      Promise.all(votePromises)
        .then(() => {
          db.run(
            "INSERT INTO user_votes (user_id) VALUES (?)",
            [userId],
            (err) => {
              if (err) {
                console.error("Error recording user vote:", err);
                return res.status(500).send("Error processing votes");
              }

              // Update user status to "Voted"
              db.run(
                "UPDATE users SET has_voted = 1 WHERE id = ?",
                [userId],
                (err) => {
                  if (err) {
                    console.error("Error updating user vote status:", err);
                    return res.status(500).send("Error updating vote status");
                  }
                  res.redirect("/dashboard");
                }
              );
            }
          );
        })
        .catch((err) => {
          console.error("Error processing votes:", err);
          res.status(500).send("Error processing votes");
        });
    }
  );
});

app.get("/forget-password", (req, res) => {
  res.render("forget-password");
});

app.post("/forget-password", (req, res) => {
  const { username, password, passwordConfirm } = req.body;

  if (password !== passwordConfirm) {
    return res.status(400).send("Passwords do not match");
  }

  db.get("SELECT * FROM auth WHERE username = ?", [username], (err, user) => {
    if (err) {
      return res.status(500).send("An error occurred");
    }
    if (!user) {
      return res.status(404).send("Username does not exist");
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).send("An error occurred");
      }
      db.run(
        "UPDATE auth SET password = ? WHERE username = ?",
        [hash, username],
        function (err) {
          if (err) {
            return res.status(500).send("An error occurred");
          }

          // Redirect to login after successful password update
          res.redirect('/login?success=true');
        }
      );
    });
  });
});

// VOTER SETTING PAGE ROUTE
app.get("/voter/setting", (req, res) => {
 if (!req.session.userId) {
   return res.redirect("/login");
 }
  res.render("voter-setting");
  });

  // POST ROUTE FOR UPDATING THE USER PASSWORD FROM THE SEETING PAGE
  app.post('/setting/forget-password', (req, res) => {
    const { username, password, passwordConfirm } = req.body;

  if (password !== passwordConfirm) {
    return res.status(400).send("Passwords do not match");
  }

  db.get("SELECT * FROM auth WHERE username = ?", [username], (err, user) => {
    if (err) {
      return res.status(500).send("An error occurred");
    }
    if (!user) {
      return res.status(404).send("Username does not exist");
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).send("An error occurred");
      }
      db.run(
        "UPDATE auth SET password = ? WHERE username = ?",
        [hash, username],
        function (err) {
          if (err) {
            return res.status(500).send("An error occurred");
          }
          res.status(200).send("username updated successfully");
        }
      );
    });
  });
  });

// ROUTE FOR UPDATING THE USERNAME
app.post('/setting/change/username', (req, res) => {
  const { Currentusername, Newusername } = req.body;

  db.get("SELECT * FROM auth WHERE username = ?", [Currentusername], (err, user) => {
    if (err) {
      return res.status(500).send('An error occured');
    }
    if (!user) {
      res.send('user do not exist');
    }
    db.run("UPDATE auth SET username = ? WHERE username = ?", 
      [Newusername, Currentusername],
      function (err) {
        if (err) {
          return res.status(500).send("An error occurred");
        }

        // Redirect to login after successful password update
        res.redirect('/voter/setting');
      }
    )
  })
})



// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out. Please try again.");
    }
    res.redirect("/login");
  });
});

app.listen(port, () => {
  console.log(`App is listening to port ${port}`);
});
