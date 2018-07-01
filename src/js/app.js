(function() {
  'use strict';
 
  /*==================================================================
  Global variables used across
  ==================================================================*/
  const currencyAPIUrlBase = 'https://free.currencyconverterapi.com/api/v5/';
  const currency_list = '';
  const convertBtn = $('#convertbtn'), amountInp = $('#amount'), 
  fromDrp = $('#from_drp'), toDrp = $('#to_drp'), 
  resultView = $('p.result b'), checkBtn = $('#checkbtn');
  let app = {
    currencyList : {},
  };

  /*end of global variable========================================*/
 
  /*==================================================================
  service worker functions below
  =================================================================*/
 
  /*register sw*/
  app.registerServiceWorker = ()=>{
    if (!navigator.serviceWorker) return;
 
    navigator.serviceWorker.register('/currency-converter/service-worker.js').then((reg)=> {
      if (!navigator.serviceWorker.controller) {
        return;
      }
 
      if (reg.waiting) {
        console.log('[ServiceWorker] is waiting - call update sw');
        app.updateWorker(reg.waiting);
        return;
      }
 
      if (reg.installing) {
        console.log('[ServiceWorker] is installing - call to track Installing sw');
        app.trackInstalling(reg.installing);
        return;
      }
 
      reg.addEventListener('updatefound', ()=> {
        console.log('[ServiceWorker] is installing - call to track Installing sw');
        app.trackInstalling(reg.installing);
      });
    });
  };
 
  /*track sw installing*/
  app.trackInstalling = (worker)=> {
    worker.addEventListener('statechange', function() {
      console.log('[ServiceWorker] statechange -trackInstalling');
      if (worker.state == 'installed') {
        app.updateWorker(worker);
      }
    });
  };
 
  /*update sw*/
  app.updateWorker = (worker)=> {
    console.log('[ServiceWorker] action to update worker called -skipWaiting');
    worker.postMessage({action: 'skipWaiting'});
  };
  /*end service worker functions====================================*/
 
 
  /*==================================================================
  Currency APi functions
  ==================================================================*/
  app.Api = ()=>{
    return {
      getCurrencyList: ()=>{
        return new Promise((resolve,reject)=>{
          fetch(`${currencyAPIUrlBase}currencies?`).then((response)=>{
            response.json().then((data)=>{
                if(data){
                  resolve(data.results);
                }else{
                  reject('error fetching list');
                }
              });
          });
        });
      },
      convertCurrency: (from,to)=>{
        return new Promise((resolve,reject)=>{
          fetch(`${currencyAPIUrlBase}convert?q=${from}_${to}&compact=ultra`).then((response)=>{
            response.json().then((data)=>{
                resolve(data);
              });
          }).catch((e)=> {
              reject(e.message);
          });
        });
      },
      historicalData: (from,to,date)=>{
        return new Promise((resolve,reject)=>{
          fetch(`${currencyAPIUrlBase}convert?q=${from}_${to}&compact=ultra&date=${date}`).then((response)=>{
            response.json().then((data)=>{
                resolve(data);
              });
          }).catch((e)=> {
              reject(e.message);
          });
        });
      }
    }
  }
  /*end currency api functions====================================*/
 
  /*==================================================================
  Currency functions
  ==================================================================*/
 
  /*display currency list*/
  app.displayList = (lists)=>{
    let htmlstr = '';
    for(let item of Object.keys(lists).sort()){
      let { currencyName, currencySymbol } = lists[item];
      let opt = `<option value="${item}" data-symbol="${currencySymbol}">${item} ( ${currencyName} )</option>`;
      htmlstr += opt;
    }
    $('select').html(htmlstr);
    $('select').formSelect();
  }
 
  /**/
  app.saveRateLocal = (rateList)=>{
    window.localforage.setItem('rateList', rateList.sort());
  }
 
  app.saveRate = (data)=>{
    const key = Object.keys(data)[0];
    const val = data[key];
 
    window.localforage.getItem('rateList', function(err, list) {
      if (list) {
 //create localDB -rateList and add item and update localDB -rateList
        let exist = list.filter((rateObj)=>{
          return (Object.keys(rateObj)[0] == key);
        });
        
        if(exist.length > 0){
          const newRateList = list.map((obj)=>{
            let newobj = {};
            newobj[key] = val;
            return Object.keys(obj)[0] == key ? newobj : obj;
          });
          console.log('newRateList ', newRateList);
          app.saveRateLocal(newRateList);
        }else{
          list.push(data);
          app.saveRateLocal(list);
        }
 
      } else {        
        //create localDB -rateList and add item
        let rateList = [];
        rateList.push(data);
        app.saveRateLocal(rateList);
      }
    });
  }

  app.formatDate = (date)=>{
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
  }
  

app.convertLocal = (key)=>{
  const errMsg = 'Fetct fail: connect to internet';
  return new Promise((resolve,reject)=>{
    window.localforage.getItem('rateList', function(err, list) {
      if (list) {
  //create localDB -rateList and add item and update localDB -rateList
        let exist = list.filter((rateObj)=>{
          return (Object.keys(rateObj)[0] == key);
        });
        
        (exist.length > 0)? resolve(exist[0]) : reject(errMsg);
  
      } else {        
        reject(errMsg);
      }
    });
  });
  
}

app.computeResult = (data,amount,symbol)=>{
  console.log(data);
  const key = Object.keys(data)[0];
  const val = data[key];
  //calculate rate
  const result = parseFloat(amount) * parseFloat(val);

  resultView.html(`${symbol} ${result}`);
  //M.toast({html: `result: ${result}`});
  convertBtn.html(`Convert`);
}

  app.event = ()=>{
 
    convertBtn.on('click', function(){
      const amount = amountInp.val();
      const from = fromDrp.val();
      const to = toDrp.val();
      const sym = toDrp.find('option:selected').data('symbol');
      const symbol = (sym != 'undefined')? sym : to;

      if(amount.length == 0){
        //display error
        M.toast({html: 'Please specify amount!'});
        return;
      }
      convertBtn.html(`Converting...`);
      app.Api().convertCurrency(from,to).then((data)=>{
        app.computeResult(data,amount,symbol);
        //save to loacal DB
        app.saveRate(data);
      }).catch((err)=>{
        const key = `${from}_${to}`;
        console.log(key);
        app.convertLocal(key).then((data)=>{
          app.computeResult(data,amount,symbol);
        }).catch((err)=>{
          convertBtn.html(`Convert`);
          resultView.html(0.00);
          M.toast({html: `${err}`});
        })
      });
    });
    
    checkBtn.on('click', function(){
      const d = $('.datepicker').val();
      const from = $('#from_drp2').val();
      const to = $('#to_drp2').val();

      if(d.length == 0){
        //display error
        M.toast({html: 'Please specify date!'});
        return;
      }
      checkBtn.html(`Checking...`);
      const date = app.formatDate(d);
      app.Api().historicalData(from,to,date).then((data)=>{
        const key = Object.keys(data)[0];
        const dateObj = data[key];
        const dateKey = Object.keys(dateObj)[0];
        const rateValue = dateObj[dateKey];

        console.log(key, rateValue);
        const result = `1 of ${from} is equivalent to ${rateValue} of ${to} on ${d}`;
        $('p.history.result b').html(result);
        checkBtn.html(`Check`);
      }).catch((err)=>{        
        $('p.history.result b').html('');
        checkBtn.html(`Check`);
        M.toast({html: `${err}`});
      });
    });
  }
  /* app.init */
  app.init = ()=>{
    //call sw registration
    app.registerServiceWorker();
    //currency list check
    app.Api().getCurrencyList().then((data)=>{
      console.log('list ', data);
      //display ui
      app.displayList(data);
    });
  }
 
  document.addEventListener('DOMContentLoaded', function() {
    app.init();
    app.event();
    $('.tabs').tabs();
    $('.datepicker').datepicker();
  });
  
 })();
