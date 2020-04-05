### use optimal build (recommended for playing)

```javascript
javascript:
(window.TwCheese && TwCheese.tryUseTool('MassTagIncomings'))
|| $.ajax('https://robindepauw.github.io/twcheese/launch/MassTagIncomings.js?'
+~~((new Date())/3e5),{cache:1});void 0;
```

### use es modules (recommended for development)

```javascript
javascript:
(window.TwCheese && TwCheese.tryUseTool('MassTagIncomings'))
|| $.getScript('https://robindepauw.github.io/twcheese/launch/esm/MassTagIncomings.js');
void 0;
```
