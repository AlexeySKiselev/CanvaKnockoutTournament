/**
 * Promise-like request function
 * @param options - object with request options:
 *      method: string - REST methods (CRUD) - Required
 *      url: string - request URL - Required
 *      params: string or object - request params - Optional
 *      headers: object - request Headers - Optional
 */

function request(options){
    return new Promise((resolve, reject) => {
        // Params
        // If params is a String
        let params = options.params || '';
        // If params is an Object
        if(options.params && typeof options.params === 'object'){
            params = Object.keys(options.params).map(param => {
                return encodeURIComponent(param) + '=' + encodeURIComponent(params[param]);
            }).join('&');
        }

        let xhr = new XMLHttpRequest();
        if(options.method === 'GET'){
            xhr.open(options.method, options.url+'?'+params, true);
        } else {
            xhr.open(options.method, options.url, true);
        }

        xhr.onload = () => {
            let response = JSON.parse(xhr.response);
            if(response.error){
                reject(response);
            } else {
                resolve(response);
            }
        };
        xhr.onerror = () => {
            reject({
                status: xhr.status,
                statusText: xhr.statusText
            });
        };

        // Default headers
        let headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        // Assign headers
        headers = Object.assign(options.headers, headers);
        // Headers
        Object.keys(headers).map(header => {
            xhr.setRequestHeader(header, headers[header]);
        });

        xhr.send(params);
    });
}

// Add event listener to ensure, that document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create elements selectors in VanillaJS
    let teamsPerMatch = document.getElementById('teamsPerMatch'),
        numberOfTeams = document.getElementById('numberOfTeams'),
        start = document.getElementById('start'),
        winner = document.getElementById('winner'),
        error = document.getElementById('error'),
        progress = document.getElementById('progress'),
        infoPanel = document.getElementById('info');

    // Add event listener to start button
    start.addEventListener('click', e => {
        e.preventDefault();
        // Remove error message before the request
        error.classList.remove('error_show');
        /**
         * Create a POST request to /tournament endpoint
         * In .then method I am going to work with tournament and first round data
         */
        request({
            method: 'POST',
            url: '/tournament',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            params: {
                teamsPerMatch: teamsPerMatch.value,
                numberOfTeams: numberOfTeams.value
            }
        })
            .then(response => {
                // clear progress bar
                while(progress.firstChild) {
                    progress.removeChild(progress.firstChild);
                }
                /** So, I don't have an endpoint for getting number of matches and rounds
                 * I am going to calculate these values
                 * I will divide @numberOfTeams by @teamsPerMatch until I will get 1
                 * Number of iterations equals number of rounds
                 * Cumulative sum equals to number of Matches
                 */
                let numberOfRounds = 0,
                    teamsPerMatchInt = parseInt(teamsPerMatch.value),
                    numberOfTeamsInt = parseInt(numberOfTeams.value),
                    numberOfTeamsIntForBar = parseInt(numberOfTeams.value),
                    bar;
                while(numberOfTeamsInt > 1){
                    numberOfTeamsInt /= teamsPerMatchInt;
                    /** Create information progress bar
                     * Create Objects and add to DOM
                     * I use {current round}*{number of teams} + {current match} formula for getting unique bar ID
                     * It is useful to wok with this formula later
                     */
                    for(let i = 0; i < numberOfTeamsInt; i += 1){
                        bar = document.createElement('div');
                        bar.setAttribute('id', 'progressBar'+(numberOfRounds*numberOfTeamsIntForBar + i));
                        bar.className = 'progress_square';
                        progress.appendChild(bar);
                    }
                    numberOfRounds += 1;
                }
                /**
                 * Starting a game
                 * Iterate over response.matchUps starting from round 0 to @numberOfRounds
                 */
                let round = 0;
                /**
                 * Create "teams" Object for teams information
                 * I need it for preventing multiple requests to API
                 */
                let teams = {};
                /**
                 * Create @matchUps object for while loop
                 * Each loop I am going to update this object due to round results
                 */
                let matchUps = response.matchUps;
                /**
                 * Iterate over all rounds
                 * After each round I will wait all Promises (playing all matches in one round) to evaluate
                 * Then re-create new @matchUps object for the new round
                 */
                (function playMatches(round, matchUps){
                    /**
                     * Create information about tournament progress
                     */
                    infoPanel.innerText = 'Teams are playing round ' + (round + 1) + '...';
                    /**
                     * Iterate over all matches in one round
                     * In result create an Object with new matchUps array
                     * I add all Promise-like requests to array
                     * Then wait for all Promises and generate result winners array for this round
                     */
                    let matches = [];
                    for(let match of matchUps){
                        /**
                         * Get match score at first request
                         * Push all Promise-like requests to ensure that all matches plays in one round
                         */
                        matches.push(request({
                            method: 'GET',
                            url: '/match',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            params: {
                                tournamentId: response.tournamentId,
                                round,
                                match: match.match
                            }
                        })
                            .then(matchScore => {
                                let teamRequests = [];
                                /**
                                 * Add @matchScore to result Promise Array for the next steps
                                 */
                                teamRequests.push(matchScore);
                                /**
                                 * Get teams score
                                 * Use Promise.all for getting all scores from async requests in one match
                                 */
                                for(let teamid of match.teamIds){
                                    teamRequests.push(request({
                                        method: 'GET',
                                        url: '/team',
                                        headers: {
                                            'Content-Type': 'application/x-www-form-urlencoded'
                                        },
                                        params: {
                                            tournamentId: response.tournamentId,
                                            teamId: teamid
                                        }
                                    }));
                                }
                                /**
                                 * Waiting for all teams (in one match) requests
                                 */
                                return Promise.all(teamRequests);
                            })
                            .then(scores => {
                                /** Create a request string
                                 * Then return request Promise to /winner endpoint
                                 */
                                let winnerRequestString = 'tournamentId=' + response.tournamentId + '&matchScore=' + scores[0].score;
                                for(let s = 1; s < scores.length; s += 1){
                                    // teams scores
                                    winnerRequestString += '&teamScores=' + scores[s].score;
                                    teams[scores[s].teamId] = {name: scores[s].name, score: scores[s].score};
                                }
                                return request({
                                    method: 'GET',
                                    url: '/winner',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded'
                                    },
                                    params: winnerRequestString
                                });
                            })
                            .then(winningScore => {
                                let matchBar = document.getElementById('progressBar' + (round*numberOfTeamsIntForBar + match.match));
                                /**
                                 * Check teams for scores and compare with winning scores to get the winner's Id
                                 * I use @teams Object to avoid duplicated requests to /team endpoint
                                 *  !!! I confused at this point, because: The winners of this match will play with the winner in other match,
                                 *  !!! But there is no requirement which match's winner current winner will play with
                                 *  !!! As there are no requirements about the matches, I am going to iterate over "this round" winners
                                 *  !!! Then connect @teamsPerMatch neighbors for the next round
                                 *  !!! The problem is in async requests: In resulting array I can get a winners from 1 and 100 match (not from 1 and 2 matches) like a neighbors
                                 *  !!! To solve this problem I can return not only the winner of match, but also match ID
                                 */
                                /**
                                 * I iterate over match.teamIds array, then compare it with @teams Object scores
                                 * And get the minimum Id as a requirement
                                 */
                                let minId = Infinity;
                                for(let t of match.teamIds){
                                    if(teams[t].score === winningScore.score && t < minId){
                                        minId = t;
                                    }
                                }
                                matchBar.classList.add('filled');
                                return minId;
                            })
                        );
                    }
                })(round, matchUps);
            })
            .catch(err => {
                error.innerText = err.message;
                error.classList.add('error_show');
            });
    });
});
