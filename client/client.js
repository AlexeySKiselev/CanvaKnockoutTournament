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
